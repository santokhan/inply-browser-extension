import { ltmTenderForms } from "../../../data/ltmTenderForms";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { tenantAuth, db } from "../../../firebase/config";
import { FillSignEncryptSave } from "../encrypt/actions/FillSignEncryptSave";
import { getActiveTabSafe } from "../../../utils/chrome";
import { sendLtmMessage } from "../../../utils/ltmMessaging";
import useCustomerSession from "../../../hooks/useCustomerSession";
import { tenantCustomersPath } from "../../../data/tenantCustomerPaths";
import { resolveTenderCustomer } from "../../../utils/tenderCustomer";

const DEFAULT_FORM_ORDER = Object.keys(ltmTenderForms.forms);

function fieldLabel(key) {
  return key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function storageError(error, fallback) {
  if (error.code === "permission-denied") {
    return "Firestore denied access to your LTM forms. Update the ltmTenderForms/{tenantUid} security rule to allow the signed-in owner, then retry.";
  }
  return error.message || fallback;
}

export default function LtmForm() {
  const { currentCustomer } = useCustomerSession();
  const [savedForms, setForms] = useState(ltmTenderForms.forms);
  const [customerDetails, setCustomerDetails] = useState({});
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const formCustomer = resolveTenderCustomer(customers, currentCustomer, selectedCustomerId);
  const customerKey = formCustomer?.id || formCustomer?.email || "";
  const details = customerKey ? customerDetails[customerKey] : null;
  const forms = {
    ...savedForms,
    tenderer_information: {
      ...savedForms.tenderer_information,
      values: {
        ...savedForms.tenderer_information.values,
        tenderer_details: {
          tenderers_legal_title: details?.tenderers_legal_title ?? formCustomer?.businessName ?? savedForms.tenderer_information.values.tenderer_details.tenderers_legal_title,
          tenderers_registered_address: details?.tenderers_registered_address ?? formCustomer?.registeredAddress ?? savedForms.tenderer_information.values.tenderer_details.tenderers_registered_address,
        },
      },
    },
  };
  const [tenantUid, setTenantUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [runningForm, setRunningForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const highlightQueue = useRef(Promise.resolve());
  const highlightedTab = useRef(null);

  function highlightField(formKey, form, section, field, focused) {
    highlightQueue.current = highlightQueue.current.then(async () => {
      if (highlightedTab.current !== null) {
        const tabId = highlightedTab.current;
        highlightedTab.current = null;
        await sendLtmMessage(tabId, { action: "highlightLtmField", focused: false }).catch(() => {});
      }
      if (!focused) return;
      const tab = await getActiveTabSafe();
      if (!tab?.id) return;
      highlightedTab.current = tab.id;
      await sendLtmMessage(tab.id, {
        action: "highlightLtmField", formKey, form, section, field, focused: true,
      });
    }).catch(() => {});
  }

  useEffect(() => () => {
    highlightField(null, null, null, null, false);
  }, []);

  useEffect(() => {
    let active = true;
    let request = 0;
    const unsubscribe = onAuthStateChanged(tenantAuth, async (tenant) => {
      const currentRequest = ++request;
      setTenantUid(null);
      setLoading(true);
      setError("");
      setMessage("");
      setForms(ltmTenderForms.forms);
      setCustomerDetails({});
      setCustomers([]);
      setSelectedCustomerId("");
      try {
        if (!tenant) throw new Error("Sign in to your tenant account to load and save LTM forms.");
        const [snapshot, customerSnapshot] = await Promise.all([
          getDoc(doc(db, "ltmTenderForms", tenant.uid)),
          getDocs(collection(db, ...tenantCustomersPath(tenant.uid))),
        ]);
        if (!active || currentRequest !== request) return;
        setCustomers(customerSnapshot.docs.map((item) => {
          const data = item.data();
          return { id: item.id, email: data.email, businessName: data.businessName, registeredAddress: data.registeredAddress };
        }));
        const stored = snapshot.data()?.forms ?? {};
        const loaded = Object.fromEntries(Object.entries(ltmTenderForms.forms).map(([key, form]) => [
          key,
          form.values ? {
            ...form,
            values: Object.fromEntries(Object.entries(form.values).map(([section, fields]) => [
              section,
              Object.fromEntries(Object.entries(fields).map(([field, fallback]) => [
                field,
                typeof stored[key]?.values?.[section]?.[field] === "string"
                  ? stored[key].values[section][field] : fallback,
              ])),
            ])),
          } : form,
        ]));
        setForms(loaded);
        // Older saves may contain empty placeholders; let customer defaults fill them.
        setCustomerDetails(Object.fromEntries(Object.entries(snapshot.data()?.customerDetails ?? {}).map(([key, fields]) => [
          key, Object.fromEntries(Object.entries(fields ?? {}).filter(([, value]) => typeof value === "string" && value.trim())),
        ])));
        setTenantUid(tenant.uid);
      } catch (err) {
        if (active && currentRequest === request) setError(storageError(err, "Could not load LTM forms."));
      } finally {
        if (active && currentRequest === request) setLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [reload]);

  function updateValue(key, section, field, value) {
    setMessage("");
    setError("");
    if (key === "tenderer_information" && section === "tenderer_details" && customerKey) {
      setCustomerDetails((current) => ({
        ...current,
        [customerKey]: { ...(current[customerKey] ?? forms[key].values.tenderer_details), [field]: value },
      }));
    } else {
      setForms((current) => ({
        ...current,
        [key]: {
          ...current[key],
          values: {
            ...current[key].values,
            [section]: { ...current[key].values[section], [field]: value },
          },
        },
      }));
    }
    // Keep edits ordered with focus/blur messages so typing updates the same tab.
    highlightQueue.current = highlightQueue.current.then(async () => {
      const tabId = highlightedTab.current ?? (await getActiveTabSafe())?.id;
      if (tabId == null) throw new Error("Open the matching LTM webpage to apply this value.");
      const result = await sendLtmMessage(tabId, {
        action: "setLtmFieldValue", formKey: key, form: forms[key], section, field, value,
      });
      if (!result?.ok) throw new Error(result?.message || "Could not apply the value to the webpage.");
    }).catch((err) => {
      setError(err.message || "Reload the webpage and try editing again.");
    });
  }

  async function saveForm(event, key) {
    event.preventDefault();
    setSaving(key);
    setError("");
    setMessage("");
    try {
      if (!tenantUid || tenantAuth.currentUser?.uid !== tenantUid) throw new Error("Sign in again to save LTM forms.");
      await setDoc(doc(db, "ltmTenderForms", tenantUid), {
        forms: { [key]: { values: savedForms[key].values } },
        ...(key === "tenderer_information" && customerKey ? {
          customerDetails: { [customerKey]: forms[key].values.tenderer_details },
        } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage(`${forms[key].name} saved.`);
    } catch (err) {
      setError(storageError(err, "Could not save LTM form."));
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p role="status" className="p-3 text-sm text-gray-500">Loading LTM forms...</p>;

  return (
    <div className="p-3 space-y-2">
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {message && <p role="status" className="text-xs text-green-700">{message}</p>}
      {!tenantUid ? (
        <button type="button" onClick={() => setReload((value) => value + 1)} className="secondary">Retry loading</button>
      ) : DEFAULT_FORM_ORDER.map((key) => {
        const form = forms[key];
        return (
          <div key={key} className="flex items-start gap-2 bg-white rounded-xl p-3 shadow-sm">
            <details className="min-w-0 flex-1">
              <summary className="cursor-pointer text-sm font-medium text-gray-800">
                {form.name}
                <div className="flex gap-1 mt-1">
                  <FillSignEncryptSave
                    beforeRun={(tabId) => {
                      return sendLtmMessage(tabId, { action: "fillLtmForm", formKey: key, form });
                    }}
                    className="sm whitespace-nowrap"
                    disabled={saving !== null || (runningForm !== null && runningForm !== key)}
                    onRunningChange={(running) => setRunningForm(running ? key : null)}
                  />
                </div>
              </summary>
              <form onSubmit={(event) => saveForm(event, key)} className="mt-3 space-y-3">
                <fieldset className="space-y-3">
                  {form.values ? Object.entries(form.values).map(([section, fields]) => (
                    <section key={section}>
                      <h2 className="text-xs font-semibold text-gray-500 mb-1">
                        {fieldLabel(section)}
                      </h2>
                      {key === "tenderer_information" && section === "tenderer_details" && customers.length > 0 && (
                        <label className="mb-2 block text-xs text-gray-600">
                          Customer for this form
                          <select
                            value={formCustomer?.id || ""}
                            onChange={(event) => { setSelectedCustomerId(event.target.value); setMessage(""); }}
                            className="default mt-1 bg-white"
                          >
                            <option value="">Select a customer</option>
                            {customers.map((customer) => (
                              <option key={customer.id} value={customer.id}>{customer.businessName || customer.email}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="space-y-1">
                        {Object.entries(fields).map(([field, value]) => (
                          <label
                            key={field}
                            className="block text-xs rounded-md bg-indigo-50 px-2 py-2"
                          >
                            <span className="text-gray-600">{fieldLabel(field)}</span>
                            <input
                              type="text"
                              value={value}
                              disabled={!(key === "tenderer_information" && section === "tenderer_details") && (saving !== null || runningForm !== null)}
                              onFocus={() => highlightField(key, form, section, field, true)}
                              onBlur={() => highlightField(key, form, section, field, false)}
                              onChange={(event) => updateValue(key, section, field, event.target.value)}
                              className="default mt-1 bg-white"
                            />
                          </label>
                        ))}
                      </div>
                    </section>
                  )) : (
                    <p className="text-xs text-gray-500">No preset values for this form.</p>
                  )}
                  {form.values && <button type="submit" disabled={saving !== null || runningForm !== null} className="default w-full">{saving === key ? "Saving..." : "Save values"}</button>}
                </fieldset>
              </form>
            </details>
          </div>
        );
      })}
    </div>
  );
}
