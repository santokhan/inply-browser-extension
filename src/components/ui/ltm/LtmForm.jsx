import { ltmTenderForms } from "../../../data/ltmTenderForms";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase/config";
import { ArrowDown, ArrowUp } from "lucide-react";
import SignEncryptSave from "../encrypt/actions/SignEncryptSave";

const DEFAULT_FORM_ORDER = Object.keys(ltmTenderForms.forms);

function normalizeFormOrder(storedOrder) {
  const knownKeys = new Set(DEFAULT_FORM_ORDER);
  return [...new Set([
    ...(Array.isArray(storedOrder) ? storedOrder.filter((key) => knownKeys.has(key)) : []),
    ...DEFAULT_FORM_ORDER,
  ])];
}

function fieldLabel(key) {
  return key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function storageError(error, fallback) {
  if (error.code === "permission-denied") {
    return "Firestore denied access to your LTM forms. Update the ltmTenderForms/{uid} security rule to allow the signed-in owner, then retry.";
  }
  return error.message || fallback;
}

export default function LtmForm() {
  const [forms, setForms] = useState(ltmTenderForms.forms);
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [formOrder, setFormOrder] = useState(DEFAULT_FORM_ORDER);
  const [sorting, setSorting] = useState(false);
  const [runningForm, setRunningForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    let request = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const currentRequest = ++request;
      setUid(null);
      setLoading(true);
      setError("");
      setMessage("");
      setForms(ltmTenderForms.forms);
      setFormOrder(DEFAULT_FORM_ORDER);
      try {
        if (!user) throw new Error("Sign in with Firebase to load and save LTM forms.");
        const snapshot = await getDoc(doc(db, "ltmTenderForms", user.uid));
        if (!active || currentRequest !== request) return;
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
        setFormOrder(normalizeFormOrder(snapshot.data()?.formOrder));
        setUid(user.uid);
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

  async function saveForm(event, key) {
    event.preventDefault();
    setSaving(key);
    setError("");
    setMessage("");
    try {
      if (!uid || auth.currentUser?.uid !== uid) throw new Error("Sign in again to save LTM forms.");
      await setDoc(doc(db, "ltmTenderForms", uid), {
        forms: { [key]: { values: forms[key].values } },
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage(`${forms[key].name} saved.`);
    } catch (err) {
      setError(storageError(err, "Could not save LTM form."));
    } finally {
      setSaving(null);
    }
  }

  async function moveForm(key, direction) {
    if (sorting || saving !== null || runningForm !== null) return;
    const index = formOrder.indexOf(key);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= formOrder.length) return;
    const nextOrder = [...formOrder];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    setSorting(true);
    setError("");
    setMessage("");
    try {
      if (!uid || auth.currentUser?.uid !== uid) throw new Error("Sign in again to sort LTM forms.");
      await setDoc(doc(db, "ltmTenderForms", uid), {
        formOrder: nextOrder,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (auth.currentUser?.uid !== uid) return;
      setFormOrder(nextOrder);
      setMessage("Form order saved.");
    } catch (err) {
      setError(storageError(err, "Could not save form order."));
    } finally {
      setSorting(false);
    }
  }

  if (loading) return <p role="status" className="p-3 text-sm text-gray-500">Loading LTM forms...</p>;

  return (
    <div className="p-3 space-y-2">
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {message && <p role="status" className="text-xs text-green-700">{message}</p>}
      {!uid ? (
        <button type="button" onClick={() => setReload((value) => value + 1)} className="secondary">Retry loading</button>
      ) : formOrder.map((key, index) => {
        const form = forms[key];
        return (
        <div key={key} className="flex items-start gap-2 bg-white rounded-xl p-3 shadow-sm">
          <div className="flex shrink-0 flex-col gap-1">
            <button type="button" onClick={() => moveForm(key, -1)} disabled={index === 0 || sorting || saving !== null || runningForm !== null} aria-label={`Move ${form.name} up`} title="Move up" className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
              <ArrowUp size={16} />
            </button>
            <button type="button" onClick={() => moveForm(key, 1)} disabled={index === formOrder.length - 1 || sorting || saving !== null || runningForm !== null} aria-label={`Move ${form.name} down`} title="Move down" className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
              <ArrowDown size={16} />
            </button>
          </div>
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer text-sm font-medium text-gray-800">
            {form.name}
            <div className="flex gap-1 mt-1">
              <SignEncryptSave
                buttonLabel="Fill Sign Encrypt Save"
                className="sm whitespace-nowrap"
                disabled={saving !== null || sorting || (runningForm !== null && runningForm !== key)}
                onRunningChange={(running) => setRunningForm(running ? key : null)}
                beforeRun={(tabId) => chrome.tabs.sendMessage(tabId, { action: "fillLtmForm", formKey: key, form })}
              />
            </div>
          </summary>
          <form onSubmit={(event) => saveForm(event, key)} className="mt-3 space-y-3">
            <fieldset disabled={saving !== null || sorting || runningForm !== null} className="space-y-3">
            {form.values ? Object.entries(form.values).map(([section, fields]) => (
              <section key={section}>
                <h2 className="text-xs font-semibold text-gray-500 mb-1">
                  {fieldLabel(section)}
                </h2>
                <div className="space-y-1">
                  {Object.entries(fields).map(([field, value]) => (
                    <label key={field} className="block text-xs rounded-md bg-indigo-50 px-2 py-2">
                      <span className="text-gray-600">{fieldLabel(field)}</span>
                      <input
                        type="text"
                        value={value}
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
            {form.values && <button type="submit" className="default w-full">{saving === key ? "Saving..." : "Save values"}</button>}
            </fieldset>
          </form>
        </details>
        </div>
        );
      })}
    </div>
  );
}
