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
      console.error("Apple abonelik doğrulaması başarısız oldu", {
        production: productionError.message,
        sandbox: sandboxError.message,
      });
      throw new HttpsError(
        "failed-precondition",
        "Apple aboneliği doğrulanamadı. Satın alma geçmişini geri yükleyip tekrar deneyin.",
      );
    }
  }
}

exports.verifyContractorPro = onCall(
  {
    region: "europe-west1",
    secrets: [appleIssuerId, appleKeyId, applePrivateKey],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Giriş yapmalısınız.");
    const { transactionId, projectId } = request.data || {};
    if (!transactionId || !projectId) {
      throw new HttpsError("invalid-argument", "transactionId ve projectId zorunludur.");
    }

    const projectRef = admin.firestore().doc(
      `users/${request.auth.uid}/projects/${projectId}`,
    );
    const project = await projectRef.get();
    if (!project.exists) {
      throw new HttpsError("not-found", "Şantiye bulunamadı.");
    }

    const statuses = await getSubscriptionStatus(transactionId);
    const active = hasActiveStatus(statuses);
    await projectRef.collection("subscriptions").doc("contractorPro").set({
      active,
      productId: CONTRACTOR_PRO_PRODUCT_ID,
      transactionId,
      environment: statuses.environment || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { active };
  },
);
