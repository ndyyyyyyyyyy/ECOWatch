import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, TagsInput } from '@grafana/ui';
import { ReportFormV2 } from 'app/extensions/types/reports';
import { emailSeparator, isEmail } from 'app/extensions/utils/validators';

import { selectors } from '../../e2e-selectors/selectors';
import { canEditReport } from '../../utils/permissions';
import { formSchemaValidationRules } from '../../utils/validation';
import ReportSection from '../ReportSection';

import { SectionProps } from './types';

export default function Recipients({ open, onToggle }: SectionProps) {
  const {
    control,
    formState: { errors },
    setError,
    clearErrors,
    setValue,
  } = useFormContext<ReportFormV2>();

  function handleTagsChange(tags: string[]) {
    // First, split any tags that contain separators (semicolons or commas)
    const splitTags = tags.flatMap((tag) =>
      tag
        .split(emailSeparator)
        .filter(Boolean)
        .map((email) => email.trim())
    );

    // Remove duplicates using Set
    const uniqueTags = [...new Set(splitTags)];

    const validEmails = uniqueTags.filter((tag) => isEmail(tag));
    const invalidEmails = uniqueTags.filter((tag) => !isEmail(tag));

    // Update form value with array of valid emails
    setValue('recipients', validEmails, {
      shouldDirty: true,
    });

    if (invalidEmails.length) {
      setError('recipients', {
        type: 'manual',
        message:
          invalidEmails.length > 1
            ? t('share-report.recipients.invalid-emails', 'Invalid emails: {{emails}}', {
                emails: invalidEmails.join('; '),
              })
            : t('share-report.recipients.invalid-email', 'Invalid email: {{email}}', {
                email: invalidEmails[0],
              }),
      });
    } else {
      clearErrors('recipients');
    }
  }

  return (
    <ReportSection
      isOpen={open}
      label={t('share-report.recipients.section-title', 'Recipients')}
      onToggle={onToggle}
      dataTestId={selectors.components.ReportFormDrawer.Recipients.header}
      contentDataTestId={selectors.components.ReportFormDrawer.Recipients.content}
    >
      <Field
        label={t('share-report.recipients.field-label', 'Recipients')}
        description={t(
          'share-report.recipients.tooltip',
          'Separate multiple email addresses with a comma or semicolon'
        )}
        required
        invalid={!!errors.recipients}
        error={errors.recipients?.message}
      >
        <Controller
          name="recipients"
          control={control}
          rules={formSchemaValidationRules().recipients}
          render={({ field: { value, ...rest } }) => (
            <TagsInput
              {...rest}
              disabled={!canEditReport}
              invalid={!!errors.recipients}
              onChange={handleTagsChange}
              placeholder={t(
                'share-report.recipients.placeholder',
                "Type in the recipients' email addresses and press Enter"
              )}
              tags={value}
              autoColors={false}
              addOnBlur
            />
          )}
        />
      </Field>
    </ReportSection>
  );
}
