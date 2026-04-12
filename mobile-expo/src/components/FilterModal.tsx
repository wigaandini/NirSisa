import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
} from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

export type SortOption = "fastest_steps" | "min_ingredients" | "most_popular";
export type RangeOption = ">10" | "5-10" | "<5";

export interface FilterState {
  sortBy: SortOption | null;
  stepsRange: RangeOption | null;
  ingredientsRange: RangeOption | null;
}

export const DEFAULT_FILTER: FilterState = {
  sortBy: null,
  stepsRange: null,
  ingredientsRange: null,
};

interface FilterModalProps {
  visible: boolean;
  initialFilter: FilterState;
  onApply: (filter: FilterState) => void;
  onClose: () => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "fastest_steps", label: "Tahapan Memasak Tercepat" },
  { value: "min_ingredients", label: "Jumlah Bahan Minimal" },
  { value: "most_popular", label: "Terpopuler" },
];

const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: ">10", label: "> 10" },
  { value: "5-10", label: "> 5 dan < 10" },
  { value: "<5", label: "< 5" },
];

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  initialFilter,
  onApply,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [sortBy, setSortBy] = useState<SortOption | null>(initialFilter.sortBy);
  const [stepsRange, setStepsRange] = useState<RangeOption | null>(initialFilter.stepsRange);
  const [ingredientsRange, setIngredientsRange] = useState<RangeOption | null>(
    initialFilter.ingredientsRange
  );

  useEffect(() => {
    if (visible) {
      setSortBy(initialFilter.sortBy);
      setStepsRange(initialFilter.stepsRange);
      setIngredientsRange(initialFilter.ingredientsRange);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleApply = () => {
    onApply({ sortBy, stepsRange, ingredientsRange });
    onClose();
  };

  const handleReset = () => {
    setSortBy("fastest_steps");
    setStepsRange(null);
    setIngredientsRange(null);
    onApply(DEFAULT_FILTER);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Bottom Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandle} />

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          <Text style={styles.sheetTitle}>Filter Resep</Text>

          {/* ── Urutkan ── */}
          <Text style={styles.sectionLabel}>Urutkan</Text>
          {SORT_OPTIONS.map((opt) => {
            const selected = sortBy === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.radioRow, selected && styles.radioRowSelected]}
                onPress={() => setSortBy(sortBy === opt.value ? null : opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>
                  {opt.label}
                </Text>
                <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* ── Tahapan Memasak ── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Tahapan Memasak</Text>
          <View style={styles.chipRow}>
            {RANGE_OPTIONS.map((opt) => {
              const selected = stepsRange === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setStepsRange(selected ? null : opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Jumlah Bahan ── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Jumlah Bahan</Text>
          <View style={styles.chipRow}>
            {RANGE_OPTIONS.map((opt) => {
              const selected = ingredientsRange === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setIngredientsRange(selected ? null : opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Actions ── */}
          <TouchableOpacity style={styles.applyButton} onPress={handleApply} activeOpacity={0.85}>
            <Text style={styles.applyButtonText}>Terapkan Filter</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={handleReset} activeOpacity={0.7}>
            <Text style={styles.resetButtonText}>Hapus Filter</Text>
          </TouchableOpacity>

          <View style={{ height: Platform.OS === "ios" ? 32 : 16 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#BFD3D6",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#2B2B2B",
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#2B2B2B",
    marginBottom: 12,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  radioRowSelected: {
    borderColor: "#BB0009",
  },
  radioLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#2B2B2B",
    flex: 1,
  },
  radioLabelSelected: {
    fontFamily: "Inter_600SemiBold",
    color: "#2B2B2B",
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#BFD3D6",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: "#BB0009",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#BB0009",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#F0F0F0",
  },
  chipSelected: {
    backgroundColor: "#BB0009",
  },
  chipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#656C6E",
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  applyButton: {
    backgroundColor: "#BB0009",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
    marginBottom: 12,
  },
  applyButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  resetButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  resetButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#2B2B2B",
  },
});

export default FilterModal;
