import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Eye, EyeOff, LogIn, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { auth, db } from "../../../firebase/config";
import { CUSTOMER_LOGIN_ACTION } from "../../../utils/customerLogin";
import useCustomerSession from "../../../hooks/useCustomerSession";

const EMPTY_CUSTOMER = {
  email: "",
  password: "",
  businessName: "",
  registeredAddress: "",
};

function customersCollection(uid) {
  return collection(db, "customerOwners", uid, "customers");
}

export default function CustomerProfile() {
  const loggedIn = useCustomerSession();
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loggingInId, setLoggingInId] = useState(null);

  const loadCustomers = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in again to load your customers.");

    const customerCollection = customersCollection(user.uid);
    const snapshot = await getDocs(customerCollection);

    // Bring forward the older single-profile document the first time the new
    // customer list is opened, so existing saved details remain available.
    if (snapshot.empty) {
      const legacyRef = doc(db, "customerProfiles", user.uid);
      const legacySnapshot = await getDoc(legacyRef);
      if (legacySnapshot.exists()) {
        const legacy = legacySnapshot.data();
        if (legacy.email || legacy.password) {
          await addDoc(customerCollection, {
            ...EMPTY_CUSTOMER,
            ...legacy,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const migrated = await getDocs(customerCollection);
          setCustomers(migrated.docs.map((item) => ({ id: item.id, ...item.data() })));
          return;
        }
      }
    }

    setCustomers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, []);

  useEffect(() => {
    let active = true;
    loadCustomers()
      .catch((err) => {
        if (active) setError(err.message || "Could not load your customers.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadCustomers]);

  function update(field, value) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  function startEdit(item) {
    setEditingId(item.id);
    setCustomer({
      email: item.email || "",
      password: item.password || "",
      businessName: item.businessName || "",
      registeredAddress: item.registeredAddress || "",
    });
    setShowPassword(false);
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setCustomer(EMPTY_CUSTOMER);
    setShowPassword(false);
  }

  async function saveCustomer(event) {
    event.preventDefault();
    if (!customer.email.trim() || !customer.password.trim()) {
      setError("Customer email and password are required.");
      setMessage("");
      return;
    }

    const normalizedEmail = customer.email.trim().toLowerCase();
    const duplicate = customers.some((item) =>
      item.id !== editingId && item.email?.trim().toLowerCase() === normalizedEmail
    );
    if (duplicate) {
      setError("A customer with this email already exists.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in again to save your customer.");
      const values = {
        email: customer.email.trim(),
        password: customer.password,
        businessName: customer.businessName.trim(),
        registeredAddress: customer.registeredAddress.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "customerOwners", user.uid, "customers", editingId), values);
        setMessage("Customer updated.");
      } else {
        await addDoc(customersCollection(user.uid), { ...values, createdAt: serverTimestamp() });
        setMessage("Customer added.");
      }
      resetForm();
      await loadCustomers();
    } catch (err) {
      setError(err.message || "Could not save the customer.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCustomer(item) {
    if (!window.confirm(`Delete the customer ${item.businessName || item.email}?`)) return;
    setError("");
    setMessage("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in again to delete this customer.");
      await deleteDoc(doc(db, "customerOwners", user.uid, "customers", item.id));
      if (editingId === item.id) resetForm();
      setCustomers((current) => current.filter((record) => record.id !== item.id));
      setMessage("Customer deleted.");
    } catch (err) {
      setError(err.message || "Could not delete the customer.");
    }
  }

  async function loginCustomer(item) {
    setLoggingInId(item.id);
    setError("");
    setMessage("");
    try {
      const result = await chrome.runtime.sendMessage({
        action: CUSTOMER_LOGIN_ACTION,
        email: item.email,
        password: item.password,
      });
      if (!result?.ok) throw new Error(result?.message || "Could not start the customer login.");
      setMessage(result.message);
    } catch (err) {
      setError(err.message || "Could not start the customer login.");
    } finally {
      setLoggingInId(null);
    }
  }

  async function copyField(item, field, value) {
    try {
      await navigator.clipboard.writeText(value || "");
      const copiedKey = `${item.id}:${field}`;
      setCopiedField(copiedKey);
      window.setTimeout(() => {
        setCopiedField((current) => current === copiedKey ? null : current);
      }, 1800);
      setError("");
    } catch {
      setError("Clipboard access failed. Check the extension's clipboard permission.");
    }
  }

  if (loading) return <div className="p-3 text-sm text-gray-500">Loading customers…</div>;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCustomers = customers.filter((item) =>
    [item.email, item.businessName, item.registeredAddress].some((value) =>
      (value || "").toLowerCase().includes(normalizedQuery)
    )
  );

  return (
    <div className="m-3 space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-800">My customers</h2>
            <p className="text-xs text-gray-500">{customers.length} saved {customers.length === 1 ? "customer" : "customers"}</p>
          </div>
          {!editingId && (
            <button type="button" onClick={() => { setError(""); setMessage(""); }} className="secondary flex items-center gap-1">
              <Plus size={14} /> Add customer
            </button>
          )}
        </div>

        <div className="mb-3 space-y-1">
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search customers</span>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by email, name, or address"
                className="default pl-8!"
              />
            </label>
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear customer search" title="Clear search" className="secondary shrink-0 p-2">
                <X size={16} />
              </button>
            )}
          </div>
          {normalizedQuery && (
            <p role="status" className="text-xs text-gray-500">
              {filteredCustomers.length} of {customers.length} customers
            </p>
          )}
        </div>

        {loggedIn === true && (
          <p role="status" className="mb-3 rounded-lg bg-green-50 p-2 text-xs text-green-700">Already logged in to eProcure. Log out on the website to sign in as another customer.</p>
        )}
        {loggedIn === null && (
          <p role="status" className="mb-3 text-xs text-gray-500">Checking eProcure session…</p>
        )}

        {customers.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">No customers yet. Add a customer below.</p>
        ) : filteredCustomers.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">No customers match your search.</p>
        ) : (
          <ul className="space-y-2">
            {filteredCustomers.map((item) => (
              <li key={item.id} className="rounded-lg border border-gray-200 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    {[
                      ["email", item.email || "", "break-all text-gray-800"],
                      ["password", "********", "text-gray-500"],
                      ["businessName", item.businessName || "", "break-words text-gray-800"],
                      ["registeredAddress", item.registeredAddress || "", "whitespace-pre-wrap break-words text-gray-600"],
                    ].map(([field, displayedValue, style]) => {
                      const copiedKey = `${item.id}:${field}`;
                      const value = field === "password" ? item.password || "" : displayedValue;
                      return (
                        <button
                          key={field}
                          type="button"
                          title={copiedField === copiedKey ? "Copied" : "Click to copy"}
                          aria-label={`Copy ${field === "businessName" ? "name" : field === "registeredAddress" ? "address" : field} for ${item.email}`}
                          onClick={() => copyField(item, field, value)}
                          className={`relative block w-full cursor-pointer rounded px-1 text-left transition-colors hover:bg-purple-50 hover:text-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${style}`}
                        >
                          {displayedValue}
                          {copiedField === copiedKey && (
                            <span role="status" className="absolute left-full top-0 z-10 ml-2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[10px] font-medium text-white shadow">
                              Copied
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-1">
                    <button type="button" aria-label="Edit customer" title="Edit" onClick={() => startEdit(item)} className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white p-1 text-gray-900 transition-colors hover:bg-gray-100"><Pencil size={16} /></button>
                    <button type="button" aria-label="Delete customer" title="Delete" onClick={() => removeCustomer(item)} className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white p-1 text-gray-900 transition-colors hover:bg-gray-100"><Trash2 size={16} /></button>
                  </div>
                </div>
                {loggedIn === false && <button
                  type="button"
                  onClick={() => loginCustomer(item)}
                  disabled={loggingInId !== null || !item.email || !item.password}
                  aria-label={`Log in to eProcure as ${item.email}`}
                  className="secondary mt-2 flex w-full items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogIn size={14} /> {loggingInId === item.id ? "Opening eProcure…" : "Login"}
                </button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={saveCustomer} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{editingId ? "Edit customer" : "Add a customer"}</h3>
          {editingId && <button type="button" aria-label="Cancel edit" onClick={resetForm} className="secondary p-1"><X size={16} /></button>}
        </div>

        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Customer email
          <input type="email" autoComplete="off" value={customer.email} onChange={(e) => update("email", e.target.value)} className="default" required />
        </label>

        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Customer password
          <div className="flex gap-2">
            <input type={showPassword ? "text" : "password"} autoComplete="new-password" value={customer.password} onChange={(e) => update("password", e.target.value)} className="default min-w-0" required />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)} className="secondary shrink-0 px-2">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Business name (optional)
          <input type="text" autoComplete="organization" value={customer.businessName} onChange={(e) => update("businessName", e.target.value)} className="default" />
        </label>

        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Registered address (optional)
          <textarea rows={2} autoComplete="street-address" value={customer.registeredAddress} onChange={(e) => update("registeredAddress", e.target.value)} className="default resize-y" />
        </label>

        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        {message && <p role="status" className="text-xs text-green-700">{message}</p>}

        <button type="submit" disabled={saving} className="default w-full">
          {saving ? "Saving…" : editingId ? "Save changes" : "Add customer"}
        </button>
      </form>
    </div>
  );
}
