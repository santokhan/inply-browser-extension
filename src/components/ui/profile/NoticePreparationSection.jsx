import { useState } from "react";
import { Table, X } from "lucide-react";
import PrepareNoticeButton from "./PrepareNoticeButton";
import Notices from "../rule/Notices";
import { syncNoticeFilter } from "../../../utils/prepareNoticeAction.js";

export default function NoticePreparationSection() {
  const [open, setOpen] = useState(false);
  const [procurementType, setProcurementType] = useState("");
  const [procurementMethod, setProcurementMethod] = useState("");
  const [procurementNature, setProcurementNature] = useState("");

  return (
    <section aria-label="Notice preparation" className="border-t border-gray-200 px-3 py-3 space-y-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Prepare Notice</h2>
        {!open && (
          <button
            type="button"
            aria-expanded={false}
            aria-controls="notice-preparation-form"
            onClick={() => setOpen(true)}
            className="secondary w-full flex items-center justify-center gap-2"
          >
            <Table size={16} aria-hidden="true" className="size-5" /> Set search filters
          </button>
        )}
      </div>

      {open && (
        <form id="notice-preparation-form" className="space-y-3 bg-white rounded-lg p-3 shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Notice Preparation Form</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notice preparation form"
              title="Close"
              className="flex size-8 items-center justify-center"
            >
              <X size={16} aria-hidden="true" className="size-5" />
            </button>
          </div>
          <label className="block space-y-1 text-sm text-gray-700">
            <span>Procurement Nature</span>
            <select name="procurementNature" value={procurementNature} onChange={(event) => {
              const value = event.target.value;
              setProcurementNature(value);
              syncNoticeFilter("procurementNature", value).catch(console.error);
            }} className="default">
              <option value="" disabled>Select procurement nature</option>
              <option value="1">Goods</option>
              <option value="2">Works</option>
              <option value="3">Service</option>
              <option value="4">Physical Services</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm text-gray-700">
            <span>Procurement Type</span>
            <select name="procurementType" value={procurementType} onChange={(event) => {
              const value = event.target.value;
              setProcurementType(value);
              syncNoticeFilter("procurementType", value).catch(console.error);
            }} className="default">
              <option value="" disabled>Select procurement type</option>
              <option value="NCT">NCT</option>
              <option value="ICT">ICT</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm text-gray-700">
            <span>Procurement Method</span>
            <select name="procurementMethod" value={procurementMethod} onChange={(event) => {
              const value = event.target.value;
              setProcurementMethod(value);
              syncNoticeFilter("procurementMethod", value).catch(console.error);
            }} className="default">
              <option value="" disabled>Select procurement method</option>
              {[
                ["1", "RFQ"], ["2", "OTM"], ["3", "LTM"], ["5", "TSTM"],
                ["6", "QCBS"], ["7", "LCS"], ["8", "SFB"], ["9", "DC"],
                ["10", "SBCQ"], ["11", "SSS"], ["12", "IC"], ["13", "CSO"],
                ["14", "DPM"], ["15", "OSTETM"], ["16", "RFQU"], ["17", "RFQL"],
              ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <PrepareNoticeButton procurementNature={procurementNature} procurementType={procurementType} procurementMethod={procurementMethod} />
          </div>
        </form>
      )}
      <Notices />
    </section>
  );
}
