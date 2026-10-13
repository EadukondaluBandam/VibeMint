import { useState, useEffect, type FC, type FormEvent } from 'react';
import { type ReportTargetType, type ReportReason, REPORT_REASONS } from '@vibemint/types';
import { colors, radius, spacing, fontWeights } from '@vibemint/design-tokens';
import { Button } from '../ui';
import { webReportsService } from '../../services/reports/reportsService';

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  onReportSubmitted?: () => void;
}

export const ReportModal: FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetLabel,
  onReportSubmitted,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('HARASSMENT_OR_BULLYING');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedReason('HARASSMENT_OR_BULLYING');
      setDescription('');
      setErrorMessage(null);
      setIsSuccess(false);
    }
  }, [isOpen, targetId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await webReportsService.submitReport({
        targetType,
        targetId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      setIsSuccess(true);
      onReportSubmitted?.();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to submit report. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetTypeDisplayName = (): string => {
    switch (targetType) {
      case 'USER':
        return 'account';
      case 'POST':
        return 'post';
      case 'COMMENT':
        return 'comment';
      default:
        return 'content';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      aria-describedby="report-modal-desc"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: spacing.md,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.dark.surface,
          border: `1px solid ${colors.dark.border}`,
          borderRadius: radius.xl,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${spacing.md} ${spacing.lg}`,
            borderBottom: `1px solid ${colors.dark.border}`,
            backgroundColor: '#0f172a',
          }}
        >
          <div>
            <h2
              id="report-modal-title"
              style={{
                fontSize: '1.125rem',
                fontWeight: fontWeights.bold,
                margin: 0,
                color: colors.dark.foreground,
              }}
            >
              Report {getTargetTypeDisplayName()}
            </h2>
            <p
              id="report-modal-desc"
              style={{
                fontSize: '0.8125rem',
                color: colors.dark.mutedForeground,
                margin: '0.125rem 0 0',
              }}
            >
              {targetLabel ? `Reporting ${targetLabel}` : 'Help keep VibeMint safe and respectful'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.dark.mutedForeground,
              fontSize: '1.25rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: spacing.xs,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        {isSuccess ? (
          <div
            style={{
              padding: spacing.xl,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
              }}
            >
              ✓
            </div>
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: fontWeights.semiBold,
                color: colors.dark.foreground,
                margin: 0,
              }}
            >
              Thank you for reporting
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: colors.dark.mutedForeground,
                lineHeight: 1.5,
                margin: 0,
                maxWidth: '380px',
              }}
            >
              We take safety seriously. Your report has been submitted to our moderation team for
              review.
            </p>
            <div style={{ marginTop: spacing.md }}>
              <Button variant="primary" size="md" onClick={onClose} style={{ minWidth: '120px' }}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              flex: 1,
            }}
          >
            <div
              style={{
                padding: spacing.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.md,
              }}
            >
              {/* Notice */}
              <div
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: radius.md,
                  padding: `${spacing.sm} ${spacing.md}`,
                  color: '#38bdf8',
                  fontSize: '0.8125rem',
                  lineHeight: 1.4,
                }}
              >
                Reports are confidential. The account owner will not be notified who submitted the
                report.
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div
                  role="alert"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    borderRadius: radius.md,
                    padding: `${spacing.sm} ${spacing.md}`,
                    color: '#f87171',
                    fontSize: '0.875rem',
                  }}
                >
                  {errorMessage}
                </div>
              )}

              {/* Reason Selector */}
              <div>
                <label
                  htmlFor="report-reason-select"
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: fontWeights.medium,
                    color: colors.dark.foreground,
                    marginBottom: spacing.xs,
                  }}
                >
                  Reason for reporting <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing.xs,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: `1px solid ${colors.dark.border}`,
                    borderRadius: radius.md,
                    padding: spacing.xs,
                    backgroundColor: colors.dark.surfaceMuted,
                  }}
                >
                  {REPORT_REASONS.map((option) => {
                    const isSelected = selectedReason === option.value;
                    return (
                      <label
                        key={option.value}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.sm,
                          padding: `${spacing.xs} ${spacing.sm}`,
                          borderRadius: radius.sm,
                          backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                          color: isSelected ? colors.dark.foreground : colors.dark.mutedForeground,
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="report-reason"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => setSelectedReason(option.value)}
                          disabled={isSubmitting}
                          style={{
                            accentColor: '#38bdf8',
                            cursor: 'pointer',
                          }}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Optional Description */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: spacing.xs,
                  }}
                >
                  <label
                    htmlFor="report-description"
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: fontWeights.medium,
                      color: colors.dark.foreground,
                    }}
                  >
                    Additional details{' '}
                    <span style={{ color: colors.dark.mutedForeground }}>(optional)</span>
                  </label>
                  <span style={{ fontSize: '0.75rem', color: colors.dark.mutedForeground }}>
                    {description.length}/1000
                  </span>
                </div>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  placeholder="Provide context that will help our review team understand what happened..."
                  disabled={isSubmitting}
                  rows={3}
                  style={{
                    width: '100%',
                    backgroundColor: colors.dark.surfaceMuted,
                    border: `1px solid ${colors.dark.border}`,
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    color: colors.dark.foreground,
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: spacing.sm,
                padding: `${spacing.md} ${spacing.lg}`,
                borderTop: `1px solid ${colors.dark.border}`,
                backgroundColor: '#0f172a',
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="md"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Submit Report
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
