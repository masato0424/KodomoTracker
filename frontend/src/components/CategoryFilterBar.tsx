import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { RECORD_CATEGORY_CONFIGS, RecordCategory } from '../types';
import { useAppTheme } from '../theme';

export interface CategoryFilterBarProps {
  selectedCategory: RecordCategory | null;
  onSelectCategory: (category: RecordCategory | null) => void;
}

const ALL_CATEGORIES = Object.values(RECORD_CATEGORY_CONFIGS);

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bgCard,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[
            styles.chip,
            {
              backgroundColor:
                selectedCategory === null
                  ? theme.primaryButtonBg
                  : theme.bgElevated,
              borderColor:
                selectedCategory === null
                  ? theme.primaryButtonBg
                  : theme.border,
            },
          ]}
          onPress={() => onSelectCategory(null)}
        >
          <Text
            style={[
              styles.chipText,
              {
                color:
                  selectedCategory === null
                    ? theme.textOnPrimary
                    : theme.textSecondary,
              },
            ]}
          >
            すべて
          </Text>
        </TouchableOpacity>

        {ALL_CATEGORIES.map((cfg) => {
          const isSelected = selectedCategory === cfg.category;
          return (
            <TouchableOpacity
              key={cfg.category}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? theme.primaryButtonBg
                    : theme.bgElevated,
                  borderColor: isSelected
                    ? theme.primaryButtonBg
                    : theme.border,
                },
              ]}
              onPress={() =>
                onSelectCategory(isSelected ? null : cfg.category)
              }
            >
              <Text style={styles.chipIcon}>{cfg.icon}</Text>
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected
                      ? theme.textOnPrimary
                      : theme.textSecondary,
                  },
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  chipIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
});

export default CategoryFilterBar;
