// Passed directly to executeScript. Keep detection independent of module scope.
export function detectFormType(forms) {
    const titleElement = document.querySelector("#divFormName");

    if (!titleElement) return null;

    // Extract heading without dashboard button
    const heading = titleElement.cloneNode(true);
    heading.querySelectorAll("a, span").forEach(el => el.remove());

    const currentTitle = heading.textContent
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    // Form aliases
    const aliases = {
        e_tender_submission_letter: [
            "e-tender submission letter",
            "tender submission letter"
        ],
        tenderer_information: [
            "tenderer information form",
            "tenderer information"
        ],
        activities_form: [
            "activity form",
            "activities form"
        ],
        personnel_information: [
            "personnel information"
        ],
        priced_boq: [
            "priced bill of quantities (boq)",
            "priced bill of quantities",
            "boq"
        ],
        tenderers_quoted_price: [
            "tenderer's quoted price",
            "tenderers quoted price"
        ]
    };

    // Normalize title by removing form number
    const normalize = title => title
        .replace(/\s*\(form\s+[^)]*\)/gi, "")
        .replace(/\s+/g, " ")
        .trim();

    const normalizedTitle = normalize(currentTitle);

    // Check configured forms and aliases
    for (const [key, form] of Object.entries(forms)) {
        const configuredName = normalize(
            form.name.replace(/\s+form$/i, "")
        );

        const possibleNames = [
            configuredName,
            ...(aliases[key] || [])
        ];

        if (possibleNames.some(name => {
            const normalizedName = normalize(name).toLowerCase();

            return normalizedTitle === normalizedName;
        })) {
            return key;
        }
    }

    // Check additional forms not in configuration
    for (const [key, names] of Object.entries(aliases)) {
        if (forms[key]) continue;

        if (names.some(name =>
            normalizedTitle === normalize(name).toLowerCase()
        )) {
            return key;
        }
    }

    return null;
}
