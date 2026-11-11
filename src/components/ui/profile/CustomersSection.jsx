import useCustomerSession from "../../../hooks/useCustomerSession";
import CustomerSessionStatus from "../../shared/CustomerSessionStatus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../shared/Tab";
import LtmForm from "../ltm/LtmForm";
import TestActions from "../test/TestActions";
import CustomerAccounts from "./CustomerAccounts";

export default function CustomersSection() {
  const { currentCustomer } = useCustomerSession();

  return (
    <section aria-labelledby="customers-heading" className="mt-4 border-t border-gray-200">
      {currentCustomer ? (
        <>
          <div className="mx-3 mb-3">
            <CustomerSessionStatus />
          </div>
          <Tabs key={currentCustomer.id || currentCustomer.email} defaultValue="ltm">
            <TabsList className="px-3">
              <TabsTrigger value="ltm">LTM Form</TabsTrigger>
              {import.meta.env.DEV && <TabsTrigger value="test">Test</TabsTrigger>}
            </TabsList>
            <TabsContent value="ltm">
              <LtmForm />
            </TabsContent>
            {import.meta.env.DEV && (
              <TabsContent value="test">
                <TestActions />
              </TabsContent>
            )}
          </Tabs>
        </>
      ) : <CustomerAccounts />}
    </section>
  );
}
