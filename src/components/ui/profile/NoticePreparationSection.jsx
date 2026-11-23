import useCustomerSession from "../../../hooks/useCustomerSession";
import PrepareNoticeButton from "./PrepareNoticeButton";

export default function NoticePreparationSection() {
  const { currentCustomer } = useCustomerSession();
  if (!currentCustomer) return null;

  return (
    <section aria-label="Notice preparation" className="px-3 border-t border-gray-200 py-3">
      <PrepareNoticeButton />
    </section>
  );
}
