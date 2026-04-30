import React from "react";

const Header = () => {
    return (
        <header className="bg-gray-50 px-3 py-1.5">
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

                <div>
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
                </div>
            </div>
        </header>
    );
};

export default Header;