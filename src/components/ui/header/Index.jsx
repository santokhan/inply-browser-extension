import React, { useState } from "react";
import { useAuth } from "../../../hooks/useAuth";

const Header = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = async () => {
        try {
            setLoggingOut(true);
            await logout();
        } finally {
            setLoggingOut(false);
        }
    };

    return (
        <header className="bg-white px-3 py-1.5">
            <div className="flex items-center">
                <img
                    src="/assets/images/logo-white.png"
                    alt="logo"
                    className="rounded-full size-9 object-cover aspect-square"
                />

                <div className="grow">
                    <h2 className="text-lg font-bold leading-none text-primary-600">
                        Inply
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-primary-800">
                        By{" "}
                        <a
                            href="https://facebook.com/SantoKhan1999"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                        >
                            Santo
                        </a>
                    </p>
                    {isAuthenticated && (
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={loggingOut}
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
    );
};

export default Header;
