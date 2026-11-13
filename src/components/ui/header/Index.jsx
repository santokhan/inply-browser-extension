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

                <div className="ml-auto flex items-center gap-2">
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
