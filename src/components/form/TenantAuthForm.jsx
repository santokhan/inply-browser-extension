import { useState } from "react";
import TenantSignUpForm from "./TenantSignUpForm";
import TenantSignInForm from "./TenantSignInForm";
import TenantForgotPasswordForm from "./TenantForgotPasswordForm";

export const forms = {
  signin: "signin",
  signup: "signup",
  forgot: "forgot"
}

export default function TenantAuthForm() {
  const [form, setForm] = useState(forms.signin);

  return (
    <>
      {form === forms.signin && <TenantSignInForm switchTo={setForm} />}
      {form === forms.signup && <TenantSignUpForm switchTo={setForm} />}
      {form === forms.forgot && <TenantForgotPasswordForm switchTo={setForm} />}
    </>
  );
}