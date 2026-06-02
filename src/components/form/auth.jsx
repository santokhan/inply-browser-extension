import { useState } from "react";
import { sign_in_with_email } from "../../firebase/methods";
import FormSignup from "./signup";
import FormSignin from "./signin";

const forms = {
  signin: "signin",
  signup: "signup",
  forgot: "forgot",
  reset: "reset"
}

export default function FormAuth() {
  const [form, setForm] = useState(forms.signin);

  return (
    <div className="">
      {form === forms.signin && <FormSignin switchTo={() => setForm(forms.signup)} />}
      {form === forms.signup && <FormSignup switchTo={() => setForm(forms.signin)} />}
    </div>
  );
}