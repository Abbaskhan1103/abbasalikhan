import { providerError, type CrmAdapter, type Lead, type Env } from '../types.ts';

/**
 * HubSpot, via the Forms API v3 submission endpoint.
 *
 * Why the Forms endpoint rather than the CRM contacts API: HubSpot does the
 * create-or-update itself, records a real form submission on the contact's
 * timeline, and applies the portal's own subscription and opt-in settings. The
 * signup looks like a signup rather than an API-injected record.
 *
 * It is also genuinely unauthenticated. There is no API key, no OAuth and no
 * token on this path: the portal ID and form GUID are both already public in
 * any embedded HubSpot form. Keeping the call server-side still buys validation,
 * rate limiting and abuse control, but there is no credential to protect here.
 *
 * A repeat submission is a plain 200, not a conflict, and the contact is updated
 * rather than duplicated. Because the response cannot tell the two apart, this
 * never reports `already`: doing so on a public endpoint would turn the form
 * into an email-enumeration oracle.
 */
export const hubspotAdapter: CrmAdapter = {
  id: 'hubspot',
  label: 'HubSpot (Forms API)',
  requiredEnv: ['HUBSPOT_PORTAL_ID', 'HUBSPOT_FORM_GUID'],

  async submit(lead: Lead, env: Env) {
    const portal = env.HUBSPOT_PORTAL_ID;
    const form = env.HUBSPOT_FORM_GUID;
    if (!portal || !form) {
      return {
        ok: false,
        status: 'not_configured',
        message: 'Signups are not set up yet.',
        retryable: false,
        detail: 'HUBSPOT_PORTAL_ID or HUBSPOT_FORM_GUID is unset',
      } as const;
    }

    /**
     * Every name here must already exist as a contact property AND be present on
     * the form definition, or the whole submission is rejected with a 400. Only
     * `email` is assumed; a first name is sent only when there is one.
     *
     * The source deliberately travels in `context.pageUri` rather than as a
     * custom property, because that needs no property to be created in the
     * portal and it feeds HubSpot's own form reporting.
     */
    const fields = [{ objectTypeId: '0-1', name: 'email', value: lead.email }];
    if (lead.name) fields.push({ objectTypeId: '0-1', name: 'firstname', value: lead.name });

    const body = {
      fields,
      context: {
        pageUri: lead.pageUrl ?? '',
        pageName: lead.source,
      },
    };

    // Note the host: api.hsforms.com, not api.hubapi.com.
    const url = `https://api.hsforms.com/submissions/v3/integration/submit/${encodeURIComponent(portal)}/${encodeURIComponent(form)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      return providerError(`hubspot fetch failed: ${String(error)}`);
    }

    if (response.ok) return { ok: true, status: 'subscribed' } as const;

    const detail = await response.text().catch(() => '');
    if (response.status === 400) {
      // Almost always a field that is not on the form, or a malformed email.
      return providerError(`hubspot rejected the submission: ${detail.slice(0, 300)}`, false);
    }
    return providerError(`hubspot responded ${response.status}: ${detail.slice(0, 200)}`);
  },
};
