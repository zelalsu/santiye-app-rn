const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const {
  AppStoreServerAPIClient,
  Environment,
  Status,
} = require("@apple/app-store-server-library");

admin.initializeApp();

const appleIssuerId = defineSecret("APPLE_ISSUER_ID");
const appleKeyId = defineSecret("APPLE_KEY_ID");
const applePrivateKey = defineSecret("APPLE_PRIVATE_KEY");

const BUNDLE_ID = "com.zelalsu.SantiyeApp";
const ANDROID_PACKAGE_NAME = "com.zelalsu.SantiyeApp";
const CONTRACTOR_PRO_PRODUCT_ID = "com.santiyencebinde.pro.monthly";

function productIdFromSignedTransaction(signedTransactionInfo) {
  if (!signedTransactionInfo) return null;

  try {
    const payload = signedTransactionInfo.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).productId || null;
  } catch {
    return null;
  }
}

function hasActiveStatus(response) {
  return (response.data || []).some((group) =>
    (group.lastTransactions || []).some((transaction) =>
      productIdFromSignedTransaction(transaction.signedTransactionInfo)
        === CONTRACTOR_PRO_PRODUCT_ID
      && (transaction.status === Status.ACTIVE
        || transaction.status === Status.BILLING_RETRY
        || transaction.status === Status.BILLING_GRACE_PERIOD),
    ),
  );
}

function createClient(environment) {
  return new AppStoreServerAPIClient(
    applePrivateKey.value(),
    appleKeyId.value(),
    appleIssuerId.value(),
    BUNDLE_ID,
    environment,
  );
}

async function getSubscriptionStatus(transactionId) {
  try {
    return await createClient(Environment.PRODUCTION).getAllSubscriptionStatuses(transactionId);
  } catch (productionError) {
    // TestFlight satın alımları Apple'ın sandbox ortamında gerçekleşir.
    // Production hatasında sandbox'ı denemek, canlı abonelikleri etkilemez.
    try {
      return await createClient(Environment.SANDBOX).getAllSubscriptionStatuses(transactionId);
    } catch (sandboxError) {
      const appleErrorDetails = (error) => ({
        name: error?.name || null,
        httpStatusCode: error?.httpStatusCode || null,
        apiError: error?.apiError || null,
        errorMessage: error?.errorMessage || error?.message || null,
      });
      console.error("Apple abonelik doğrulaması başarısız oldu", {
        transactionIdSuffix: String(transactionId).slice(-6),
        production: appleErrorDetails(productionError),
        sandbox: appleErrorDetails(sandboxError),
      });
      throw new HttpsError(
        "failed-precondition",
        "Apple aboneliği doğrulanamadı. Satın alma geçmişini geri yükleyip tekrar deneyin.",
      );
    }
  }
}

async function getGoogleSubscriptionStatus(purchaseToken) {
  const accessToken = await admin.app().options.credential.getAccessToken();
  const url = new URL(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken.access_token}` },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Google Play abonelik doğrulaması başarısız oldu", {
      status: response.status,
      body,
    });
    throw new HttpsError(
      "failed-precondition",
      "Google Play aboneliği doğrulanamadı. Play Store hesabınızı kontrol edip tekrar deneyin.",
    );
  }

  return response.json();
}

function hasActiveGoogleSubscription(subscription) {
  const entitlementStates = new Set([
    "SUBSCRIPTION_STATE_ACTIVE",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    "SUBSCRIPTION_STATE_CANCELED",
  ]);
  const now = Date.now();
  return entitlementStates.has(subscription.subscriptionState)
    && (subscription.lineItems || []).some((item) =>
      item.productId === CONTRACTOR_PRO_PRODUCT_ID
      && item.expiryTime
      && Date.parse(item.expiryTime) > now,
    );
}

exports.verifyContractorPro = onCall(
  {
    region: "europe-west1",
    secrets: [appleIssuerId, appleKeyId, applePrivateKey],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Giriş yapmalısınız.");
    const {
      platform = "ios",
      transactionId,
      purchaseToken,
      projectId,
    } = request.data || {};
    if (!projectId || !["ios", "android"].includes(platform)) {
      throw new HttpsError("invalid-argument", "platform ve projectId zorunludur.");
    }
    if (platform === "ios" && !transactionId) {
      throw new HttpsError("invalid-argument", "iOS için transactionId zorunludur.");
    }
    if (platform === "android" && !purchaseToken) {
      throw new HttpsError("invalid-argument", "Android için purchaseToken zorunludur.");
    }

    const projectRef = admin.firestore().doc(
      `users/${request.auth.uid}/projects/${projectId}`,
    );
    const project = await projectRef.get();
    if (!project.exists) {
      throw new HttpsError("not-found", "Şantiye bulunamadı.");
    }

    const statuses = platform === "android"
      ? await getGoogleSubscriptionStatus(purchaseToken)
      : await getSubscriptionStatus(transactionId);
    const active = platform === "android"
      ? hasActiveGoogleSubscription(statuses)
      : hasActiveStatus(statuses);
    const entitlementData = {
      active,
      productId: CONTRACTOR_PRO_PRODUCT_ID,
      store: platform === "android" ? "google-play" : "app-store",
      transactionId: transactionId || null,
      environment: platform === "android"
        ? (statuses.testPurchase ? "test" : "production")
        : (statuses.environment || null),
      expiryTime: platform === "android"
        ? ((statuses.lineItems || []).find(
          (item) => item.productId === CONTRACTOR_PRO_PRODUCT_ID,
        )?.expiryTime || null)
        : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await projectRef.collection("subscriptions").doc("contractorPro").set({
      ...entitlementData,
    }, { merge: true });
    // Pro üyeliği kullanıcı hesabına da yazılır. Böylece şantiye limiti gibi
    // proje dışı haklar tek bir güvenilir abonelik kaynağından kontrol edilir.
    await admin.firestore()
      .doc(`users/${request.auth.uid}/entitlements/pro`)
      .set(entitlementData, { merge: true });
    return { active };
  },
);
