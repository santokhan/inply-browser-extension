# Login to form filling

## Tenant login

### Restore a session

```mermaid
flowchart TD
    Open["Open Inply"] --> Session{"Tenant session available?"}
    Session -->|Yes| Dashboard["Show dashboard"]
    Session -->|No| SignIn["Show sign-in form"]
```

### Sign in

```mermaid
flowchart TD
    Enter["Enter tenant email and password"] --> Auth["Sign in with Firebase"]
    Auth --> Result{"Successful?"}
    Result -->|No| Error["Show error and retry"]
    Error --> Enter
    Result -->|Yes| Save["Save tenant session locally"]
    Save --> Dashboard["Show dashboard"]
```

## Customer CRUD

### View customers

```mermaid
flowchart TD
    Open["Open Customers"] --> Load["Load saved customers for the tenant"]
    Load --> List["Display customer list"]
    List --> Browse["Search or browse customers"]
```

### Create a customer

```mermaid
flowchart TD
    Add["Click Add Customer"] --> Enter["Enter customer details"]
    Enter --> Save["Click Save"]
    Save --> Validate["Validate and save customer details"]
    Validate --> Create["Create customer in Firestore"]
    Create --> Reload["Close form and reload customer list"]
```

### Update a customer

```mermaid
flowchart TD
    Edit["Click Edit on a customer"] --> Change["Change customer details"]
    Change --> Save["Click Save"]
    Save --> Validate["Validate and save customer details"]
    Validate --> Update["Update customer in Firestore"]
    Update --> Reload["Close form and reload customer list"]
```

### Validate and save customer details

```mermaid
flowchart TD
    Validate{"Email and password provided, and email unique in the list?"}
    Validate -->|No| Correct["Show error and correct details"]
    Correct --> Validate
    Validate -->|Yes| Save["Create or update customer"]
    Save --> Result{"Successful?"}
    Result -->|Yes| Reload["Close form and reload customer list"]
    Result -->|No| Retry["Show error and retry saving"]
    Retry --> Validate
```

### Delete a customer

```mermaid
flowchart TD
    Click["Click Delete on a customer"] --> Confirm{"Confirm deletion?"}
    Confirm -->|No| List["Return to customer list"]
    Confirm -->|Yes| Delete["Delete customer from Firestore"]
    Delete --> Result{"Successful?"}
    Result -->|Yes| Remove["Remove customer from displayed list"]
    Result -->|No| Error["Show error"]
    Error --> List
```

## Customer login

### Start login

```mermaid
flowchart TD
    Open["Open Customers"] --> Find["Find a saved customer"]
    Find --> Login["Click Login on that customer"]
    Login --> Logout["Clear any existing eProcure session"]
    Logout --> Page["Open eProcure login page"]
    Page --> Fill["Login on customer account"]
```

### Submit credentials

```mermaid
flowchart TD
    Filled["Customer credentials filled"] --> Auto["Extension clicks Login"]
    Auto --> Dashboard{"eProcure login successful?"}
    Dashboard -->|No| Review["Display errors"]
    Dashboard -->|Yes| Notice["Close login notice"]
    Notice --> Details["Check customer business details"]
```

### Collect missing business details

```mermaid
flowchart TD
    Missing{"Business name or registered address missing?"}
    Missing -->|Yes| Collect["Collect Company Details"]
    Collect --> Save["Save missing customer details"]
    Save --> Ready["Continue with the selected customer"]
    Missing -->|No| Ready
    Ready --> Tender["Open target tender form in eProcure"]
```

```mermaid
flowchart TD
    Missing{"Bank name missing?"}
    Missing -->|Yes| Collect["Collect Bank Details"]
    Collect --> Save["Save missing bank name"]
    Save --> Ready["Continue with the selected bank name"]
    Missing -->|No| Ready
    Ready --> Tender["Open target tender form in eProcure"]
```

## LTM form filling

### Prepare values

```mermaid
flowchart TD
    Tender["Open target tender form in eProcure"] --> Ltm["Open LTM Form in Inply"]
    Ltm --> Load["Load presets and customer details"]
    Load --> Review["Review or edit values"]
    Review --> Run["Click Fill Sign Encrypt Save"]
```

### Check encryption password

```mermaid
flowchart TD
    Run["Start Fill Sign Encrypt Save"] --> Password{"Encryption password saved?"}
    Password -->|No| Save["Enter and save encryption password"]
    Save --> Run
    Password -->|Yes| Validate["Validate the target form"]
```

### Validate and fill

```mermaid
flowchart TD
    Validate{"Matching form, expected fields and valid options?"}
    Validate -->|No| Correct["Show error and correct page or preset values"]
    Correct --> Retry["Retry Fill Sign Encrypt Save"]
    Validate -->|Yes| Fill["Fill preset values"]
    Fill --> Events["Dispatch input and change events"]
    Events --> Done["Form filling complete"]
```

## Saved-rule form filling

### Select a rule

```mermaid
flowchart TD
    Page["Open target form in browser"] --> Rules["Open Saved Rules in Inply"]
    Rules --> Select["Select a saved rule"]
    Select --> Apply["Click Apply"]
```

### Find and fill the field

```mermaid
flowchart TD
    Apply["Apply saved rule"] --> Find["Find field using parser metadata or saved selector"]
    Find --> Found{"Matching field found?"}
    Found -->|No| Error["Show error and review rule or page"]
    Error --> Apply
    Found -->|Yes| Fill["Apply saved value"]
    Fill --> Events["Dispatch input and change events"]
    Events --> Done["Form filling complete"]
```
