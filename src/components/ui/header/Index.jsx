import { useState } from "react";
import { useTenantAuth } from "../../../hooks/useTenantAuth";
import TenantWallet from "../profile/TenantWallet";

const Header = () => {
    const { tenant, signOutTenant } = useTenantAuth();
    const [signingOutTenant, setSigningOutTenant] = useState(false);
    const tenantName = tenant?.displayName?.trim() || tenant?.email || "Tenant";
    const nameParts = tenantName.split("@")[0].split(/\s+/);
    const tenantInitial = (nameParts.length > 1
        ? Array.from(nameParts[0])[0] + Array.from(nameParts.at(-1))[0]
        : Array.from(nameParts[0]).slice(0, 2).join("")).toUpperCase();

    const handleTenantSignOut = async () => {
        try {
            setSigningOutTenant(true);
            await signOutTenant();
        } finally {
            setSigningOutTenant(false);
        }
    };

    return (
        <header className="bg-white px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-y-2">
                <img
                    src="/assets/images/logo-white.png"
                    alt="Tenddoo logo"
                    className="rounded-full size-9 object-cover aspect-square"
                />

                <div className="min-w-0 grow">
                    <h2 className="text-lg font-bold leading-none text-primary-600">
                        Tenddoo
                    </h2>
                </div>

                <div className="ml-auto flex items-center gap-1">
                    <a
                        href="https://facebook.com/SantoKhan1999"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Visit Santo on Facebook"
                        title="Santo on Facebook"
                        className="inline-flex items-center justify-center rounded-full p-1 text-[#1877F2] transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true">
                            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.021 10.125 11.927v-8.437H7.078v-3.49h3.047v-2.66c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971h-1.513c-1.491 0-1.956.931-1.956 1.887v2.263h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.099 24 12.073Z" />
                        </svg>
                    </a>
                    <a
                        href="https://wa.me/8801718787756"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Contact us on WhatsApp at +8801718787756"
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full p-1 text-xs font-semibold text-green-700 transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 shrink-0" aria-hidden="true">
                            <path d="M20.52 3.48A11.91 11.91 0 0 0 12.04 0C5.45 0 .09 5.36.09 11.95c0 2.11.55 4.17 1.59 5.99L0 24l6.24-1.64a11.94 11.94 0 0 0 5.8 1.48h.01c6.59 0 11.95-5.36 11.95-11.95 0-3.19-1.24-6.19-3.48-8.41ZM12.05 21.82a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.7.97.99-3.61-.24-.37a9.88 9.88 0 0 1-1.52-5.27c0-5.48 4.46-9.94 9.94-9.94a9.87 9.87 0 0 1 7.03 2.92 9.87 9.87 0 0 1 2.91 7.03c0 5.48-4.46 9.86-10 9.86Zm5.45-7.44c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.62-.93-2.22-.24-.58-.48-.5-.68-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.09 4.49.71.3 1.27.48 1.7.62.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z" />
                        </svg>
                    </a>
                    {tenant?.uid && (
                        <TenantWallet
                            key={tenant.uid}
                            tenantUid={tenant.uid}
                            tenantName={tenantName}
                            tenantInitial={tenantInitial}
                            tenantEmail={tenant.email}
                            onSignOut={handleTenantSignOut}
                            signingOut={signingOutTenant}
                        />
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
