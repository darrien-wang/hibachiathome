# CPL-005 Manual GTM/Ads Verification Checklist

Date: 2026-03-06  
Owner: _(fill by operator)_  
Status: _Pending_

## Objective

Validate that the new non-sales events are **not** counted as Google Ads conversions.

- `support_submit` => analytics only
- `partner_application_submit` => analytics only
- `lead_submit` => sales-qualified conversion

## Step 1 — GTM Preview Session

- [ ] Open Tag Assistant and connect to the site.
- [ ] Trigger `support_submit` by submitting `/contact` form.
- [ ] Trigger `partner_application_submit` by submitting `/partner-opportunities` form.
- [ ] Trigger `lead_submit` via quote flow email contact action.

Evidence files to capture:

- `gtm-preview-support-submit.png`
- `gtm-preview-partner-application-submit.png`
- `gtm-preview-lead-submit.png`

## Step 2 — Trigger/Tag Validation

- [ ] `support_submit`: GA4 event tag fired, **Ads conversion tag NOT fired**.
- [ ] `partner_application_submit`: GA4 event tag fired, **Ads conversion tag NOT fired**.
- [ ] `lead_submit`: GA4 event tag fired, Ads conversion tag fired.

## Step 3 — Google Ads Conversion Diagnostics

- [ ] In Google Ads conversion diagnostics, confirm only `lead_submit` is receiving lead conversions from website path.
- [ ] Confirm no conversion action tied to `support_submit` or `partner_application_submit`.

Evidence files to capture:

- `google-ads-conversion-actions-overview.png`
- `google-ads-conversion-diagnostics.png`

## Final Signoff

- [ ] CPL-005 passes all checks.
- [ ] Update `CPLfeaturelist.json` => `"passes": true` for `CPL-005`.
- [ ] Append completion note in `CPL-codex-progress.md`.
