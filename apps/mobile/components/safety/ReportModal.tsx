import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { type ReportTargetType, type ReportReason, REPORT_REASONS } from '@vibemint/types';
import { mobileReportsService } from '../../src/services/reports/reportsService';

export interface ReportModalProps {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  onClose: () => void;
  onReportSubmitted?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  targetType,
  targetId,
  targetLabel,
  onClose,
  onReportSubmitted,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('HARASSMENT_OR_BULLYING');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setSelectedReason('HARASSMENT_OR_BULLYING');
    setDescription('');
    setIsSubmitting(false);
    setIsSubmitted(false);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting || isSubmitted || !targetId) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await mobileReportsService.submitReport({
        targetType,
        targetId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      setIsSubmitted(true);
      onReportSubmitted?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report';
      setErrorMessage(msg);
      Alert.alert('Report Submission Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const readableType =
    targetType === 'USER' ? 'Account' : targetType === 'POST' ? 'Post' : 'Comment';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Report {readableType}</Text>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityLabel="Close"
          >
            <Text style={styles.closeButtonText}>{isSubmitted ? 'Done' : 'Cancel'}</Text>
          </TouchableOpacity>
        </View>

        {isSubmitted ? (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Thank You for Your Report</Text>
            <Text style={styles.successSubtitle}>
              We take community safety seriously. Our team will review this{' '}
              {readableType.toLowerCase()} and take appropriate action in accordance with our
              community guidelines.
            </Text>
            <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {targetLabel && (
              <View style={styles.targetBanner}>
                <Text style={styles.targetBannerLabel}>Reporting:</Text>
                <Text style={styles.targetBannerValue} numberOfLines={1}>
                  {targetLabel}
                </Text>
              </View>
            )}

            <Text style={styles.sectionHeader}>Why are you reporting this?</Text>
            <Text style={styles.sectionSubtitle}>
              Your report is anonymous. The reported user will not know who submitted it.
            </Text>

            {/* Reasons Radio-style List */}
            <View style={styles.reasonsList}>
              {REPORT_REASONS.map((option) => {
                const isSelected = selectedReason === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.reasonRow, isSelected && styles.reasonRowSelected]}
                    onPress={() => setSelectedReason(option.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional Additional Details */}
            <View style={styles.descriptionSection}>
              <View style={styles.descriptionHeader}>
                <Text style={styles.descriptionTitle}>Additional Details (Optional)</Text>
                <Text style={styles.charCount}>{description.length}/1000</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Provide any additional context that will help us investigate..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
                maxLength={1000}
                editable={!isSubmitting}
              />
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

            {/* Submit Action */}
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#0b0f17" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  targetBannerLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  targetBannerValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  sectionHeader: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  reasonsList: {
    gap: 8,
    marginBottom: 20,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 12,
  },
  reasonRowSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#38bdf8',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38bdf8',
  },
  reasonLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  reasonLabelSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  descriptionTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  charCount: {
    color: '#64748b',
    fontSize: 11,
  },
  textInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIcon: {
    fontSize: 48,
    color: '#22c55e',
    marginBottom: 16,
  },
  successTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  doneButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  doneButtonText: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '600',
  },
});
