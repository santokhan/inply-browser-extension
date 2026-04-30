function applyRules(rules) {
    rules.forEach(rule => {
        let elements = []

        if (rule.type === "name") {
            elements = document.querySelectorAll(`[name="${rule.selector}"]`)
        } else if (rule.type === "id") {
            elements = document.querySelectorAll(`#${rule.selector}`)
        } else if (rule.type === "class") {
            elements = document.querySelectorAll(`.${rule.selector}`)
        }

        elements.forEach(el => {
            if (!el) return

            const tag = el.tagName

            if (tag === "INPUT") {
                const type = el.type?.toLowerCase()

                if (type === "checkbox" || type === "radio") {
                    el.checked =
                        rule.value === "true" ||
                        rule.value === "1" ||
                        rule.value.toLowerCase() === "checked" ||
                        rule.value.toLowerCase() === "on"
                } else {
                    const setter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype,
                        "value"
                    )?.set

                    if (setter) {
                        setter.call(el, rule.value)
                    } else {
                        el.value = rule.value
                    }
                }

                el.dispatchEvent(new Event("input", { bubbles: true }))
                el.dispatchEvent(new Event("change", { bubbles: true }))
            } else if (tag === "TEXTAREA" || tag === "SELECT") {
                el.value = rule.value
                el.dispatchEvent(new Event("input", { bubbles: true }))
                el.dispatchEvent(new Event("change", { bubbles: true }))
            } else if (tag === "OPTION") {
                const option = el
                option.selected =
                    option.value === rule.value ||
                    option.text === rule.value ||
                    option.textContent.trim() === rule.value

                const parentSelect = option.parentElement
                if (parentSelect && parentSelect.tagName === "SELECT") {
                    parentSelect.dispatchEvent(new Event("input", { bubbles: true }))
                    parentSelect.dispatchEvent(new Event("change", { bubbles: true }))
                }
            }
        })
    })
}

// Listen from popup
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "applyRule") {
        applyRules([msg.rule])
    }

    if (msg.action === "applyAllRules") {
        chrome.storage.local.get("rules", (res) => {
            applyRules(res.rules || [])
        })
    }
})