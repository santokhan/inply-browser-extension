const typeEl = document.getElementById("type")
const selectorEl = document.getElementById("selector")
const valueEl = document.getElementById("value")
const addBtn = document.getElementById("add")
const applyAllBtn = document.getElementById("applyAllBtn")
const rulesDiv = document.getElementById("rules")

let rules = []

// Load saved rules
chrome.storage.local.get(["rules"], (res) => {
    rules = res.rules || []
    renderRules()
})

// Add rule
addBtn.onclick = () => {
    if (!selectorEl.value || !valueEl.value) {
        alert("Selector and value are required")
        return
    }

    const rule = {
        type: typeEl.value,
        selector: selectorEl.value,
        value: valueEl.value
    }

    rules.push(rule)

    chrome.storage.local.set({ rules }, () => {
        selectorEl.value = ""
        valueEl.value = ""
        renderRules()
    })
}

// Apply all rules
if (applyAllBtn) {
    applyAllBtn.onclick = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "applyAllRules"
            })
        })
    }
}

// Render rules
function renderRules() {
    rulesDiv.innerHTML = ""

    rules.forEach((rule, index) => {
        const div = document.createElement("div")

        div.className =
            "p-3 rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col gap-2"

        div.innerHTML = `
            <div class="text-sm">
                <b class="text-gray-800">${rule.type}</b>:
                <span class="text-blue-600">${rule.selector}</span>
                =
                <span class="text-green-600">${rule.value}</span>
            </div>

            <div class="flex gap-2 justify-between items-center">
                <button
                    class="apply px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
                    data-index="${index}"
                >
                    Apply
                </button>

                <button
                    class="delete px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded"
                    data-index="${index}"
                >
                    Delete
                </button>
            </div>
        `

        rulesDiv.appendChild(div)
    })

    // Apply single rule
    document.querySelectorAll(".apply").forEach(btn => {
        btn.onclick = (e) => {
            const index = Number(e.target.dataset.index)

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "applyRule",
                    rule: rules[index]
                })
            })
        }
    })

    // Delete rule
    document.querySelectorAll(".delete").forEach(btn => {
        btn.onclick = (e) => {
            const index = Number(e.target.dataset.index)

            rules.splice(index, 1)

            chrome.storage.local.set({ rules }, () => {
                renderRules()
            })
        }
    })
}