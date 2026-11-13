import { useState } from "react";
import { useTenantAuth } from "../../../hooks/useTenantAuth";
import TenantWallet from "../profile/TenantWallet";

const Header = () => {
    const { tenant, signOutTenant } = useTenantAuth();
    const [signingOutTenant, setSigningOutTenant] = useState(false);

    const handleTenantSignOut = async () => {
        try {
            setSigningOutTenant(true);
            await signOutTenant();
        } finally {
            setSigningOutTenant(false);
        }
    };

    return (
        <>
        <header className="bg-white px-3 py-1.5">
            <div className="flex items-center">
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

                <div className="flex items-center gap-2">
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
                    {tenant && (
                        <button
                            type="button"
                            onClick={handleTenantSignOut}
                            aria-label="Sign out of tenant account"
                            title="Sign out of tenant account"
                            disabled={signingOutTenant}
                            className="rounded-lg border border-primary-200 hover:bg-primary-100 px-2 py-1.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" className="size-4">
                                <path d="M502.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 224 192 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l210.7 0-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l128-128zM160 96c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 32C43 32 0 75 0 128L0 384c0 53 43 96 96 96l64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l64 0z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </header>
        {tenant?.uid && <TenantWallet key={tenant.uid} tenantUid={tenant.uid} />}
        </>
    );
};

export default Header;
