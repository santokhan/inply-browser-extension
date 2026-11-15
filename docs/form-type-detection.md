# Form type detection

This reusable function detects all six form types using `#divFormName` and returns the corresponding form key. It removes links and spans from a cloned heading, normalizes whitespace and form numbers, and checks configured names and aliases. A missing heading or an unknown form returns `null`.

```javascript
function detectFormType(forms) {
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
```

## Usage

```javascript
const formType = detectFormType(data.forms);

console.log("Detected form:", formType);
```

## Expected results

| Page title | Returned value |
| --- | --- |
| e-Tender Submission Letter (Form e-PW2B-1) | `e_tender_submission_letter` |
| Tenderer Information Form (Form e-PW2B-2) | `tenderer_information` |
| Activity Form | `activities_form` |
| Personnel Information (Form e-PW2B-3) | `personnel_information` |
| Priced Bill of Quantities (BOQ) | `priced_boq` |
| Tenderer's Quoted Price | `tenderers_quoted_price` |
| Unknown Form | `null` |

This function returns only the form type key, making it easy to use throughout the extension.

```javascript
switch (detectFormType(data.forms)) {
    case "e_tender_submission_letter":
        // Handle submission letter
        break;

    case "tenderer_information":
        // Handle tenderer information
        break;

    case "activities_form":
        // Handle activity form
        break;

    case "personnel_information":
        // Handle personnel information
        break;

    case "priced_boq":
        // Handle BOQ
        break;

    case "tenderers_quoted_price":
        // Handle quoted price
        break;
}
```
