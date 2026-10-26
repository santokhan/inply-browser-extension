import { forwardRef } from "react";

const PageActionButton = forwardRef(function PageActionButton(
  { pageReady = false, disabled = false, type = "button", children, ...props },
  ref,
) {
  return (
    <button {...props} ref={ref} type={type} disabled={!pageReady || disabled}>
      {children}
    </button>
  );
});

export default PageActionButton;
