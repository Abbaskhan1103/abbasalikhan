import type { CrmAdapter, Lead, Env } from '../types.ts';

/**
 * The default. Accepts the lead, records it in the function log, and stores it
 * nowhere.
 *
 * This exists so the whole path is testable before you have chosen a provider:
 * the form submits, the endpoint validates, the visitor gets a real
 * confirmation, and the address appears in your host's logs. Switch
 * CRM_PROVIDER to a real adapter and nothing else has to change.
 *
 * It is deliberately not silent about what it is. A capture form that quietly
 * discards addresses is worse than no form, so this logs a warning every time.
 */
export const noneAdapter: CrmAdapter = {
  id: 'none',
  label: 'No provider (logs only)',
  requiredEnv: [],

  async submit(lead: Lead, _env: Env) {
    console.warn(
      '[crm] CRM_PROVIDER is "none": this signup was logged and NOT stored.',
      JSON.stringify({ email: lead.email, source: lead.source, at: lead.submittedAt }),
    );
    return { ok: true, status: 'subscribed' } as const;
  },
};
