import { useEffect, useState } from "react";
import { RulesProvider } from "../../../contexts/RulesContext";
import RuleElementForm from "./ElementForm";
import RuleForm from "./Form";
import RuleGroupForm from "../group/Group";
import SavedRules from "./Saved";
import { twMerge } from "tailwind-merge";
import SavedGroups from "../group/Saved";

function TabButton({ children, active, onClick }) {
  return (
    <button
      className={twMerge(
        "text-sm font-semibold text-gray-700 py-1.5 px-3 rounded-t-lg",
        active ? 'bg-primary-500 text-white' : "hover:bg-primary-100"
      )}
      type="button"
      onClick={onClick}
    >{children}</button>
  )
}

export default function AutoFillRules() {
  const [createGroup, setCreateGroup] = useState(false);
  const [groups, setGroups] = useState([]);
  const [show, setShow] = useState('rules');

  async function loadGroups() {
    const result = await chrome.storage.local.get("groups")
    if (result.groups) {
      setGroups(result.groups || [])
    }
  }
  useEffect(() => { loadGroups() }, []);

  return (
    <RulesProvider>
      {createGroup
        ? <RuleGroupForm onClose={() => setCreateGroup(false)} loadGroups={loadGroups} />
        : <RuleElementForm onOpen={() => setCreateGroup(true)} groups={groups} />
      }

      <div className="py-2">
        <div className="flex items-center border-b border-gray-200 px-2">
          <TabButton onClick={() => setShow('rules')} active={show === 'rules'}>
            Saved Rules
          </TabButton>
          <TabButton onClick={() => setShow('groups')} active={show === 'groups'}>
            Saved Groups
          </TabButton>
        </div>

        {show === 'rules' && <SavedRules groups={groups} />}
        {show === 'groups' && <SavedGroups groups={groups} />}
      </div>
    </RulesProvider>
  )
}
