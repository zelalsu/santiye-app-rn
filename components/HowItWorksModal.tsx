import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const STEPS = [
  {
    num: "1",
    title: "Kategori Seç",
    desc: "Demir, Beton, Sıva, Boya, Kapı, Pencere gibi malzeme kategorilerinden ihtiyacınız olanı seçin.",
  },
  {
    num: "2",
    title: "Miktar ve Fiyat Gir",
    desc: "Seçtiğiniz malzeme türü, miktar (ton/m²/adet) ve birim fiyatı girerek kalemi ekleyin.",
  },
  {
    num: "3",
    title: "Toplam Maliyeti Görün",
    desc: "Tüm kalemlerin toplamı anında hesaplanır; detaylı raporu PDF olarak indirin.",
  },
];

export default function HowItWorksModal({
  visible,
  onClose,
  onStart,
}: {
  visible: boolean;
  onClose: () => void;
  onStart: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stepAnims = useRef(STEPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
      STEPS.forEach((_, i) => {
        setTimeout(
          () => {
            Animated.spring(stepAnims[i], {
              toValue: 1,
              tension: 80,
              friction: 10,
              useNativeDriver: true,
            }).start();
          },
          150 + i * 150,
        );
      });
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      stepAnims.forEach((a) => a.setValue(0));
    }
  }, [fadeAnim, slideAnim, stepAnims, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
            >
              <View style={styles.handle} />
              <Text style={styles.title}>Nasıl Çalışır?</Text>
              <Text style={styles.subtitle}>
                3 adımda maliyet hesabınız hazır
              </Text>

              {STEPS.map((step, i) => (
                <View key={i}>
                  <Animated.View
                    style={[
                      styles.stepRow,
                      {
                        opacity: stepAnims[i],
                        transform: [
                          {
                            translateY: stepAnims[i].interpolate({
                              inputRange: [0, 1],
                              outputRange: [16, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{step.num}</Text>
                    </View>
                    <View style={styles.stepText}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDesc}>{step.desc}</Text>
                    </View>
                  </Animated.View>
                  {i < STEPS.length - 1 && <View style={styles.divider} />}
                </View>
              ))}

              <TouchableOpacity
                style={styles.ctaButton}
                onPress={onStart}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>Hemen Başla</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#191c1e",
    marginBottom: 4,
    fontFamily: "Manrope",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    fontFamily: "Inter",
  },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepNum: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0058be",
    fontFamily: "Manrope",
  },
  stepText: { flex: 1 },
  stepTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#191c1e",
    marginBottom: 3,
    fontFamily: "Manrope",
  },
  stepDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    fontFamily: "Inter",
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: "#e2e8f0",
    marginLeft: 18,
    marginVertical: 6,
  },
  ctaButton: {
    backgroundColor: "#0058be",
    height: 50,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 22,
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter",
  },
});
