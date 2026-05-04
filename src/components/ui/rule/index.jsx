import { useEffect, useState } from "react";
import { RulesProvider } from "../../../contexts/RulesContext";
import RuleElementForm from "./ElementForm";
import RuleForm from "./Form";
import RuleGroupForm from "../group/Group";
import SavedRules from "./Saved";
import { twMerge } from "tailwind-merge";
import SavedGroups from "../group/Saved";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../shared/Tab";
import { useGroups } from "../../../hooks/useGroups";

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
  const [show, setShow] = useState('rules');
  const [whichForm, setWhichForm] = useState('rule');

  return (
    <>
      <div className="text-center py-3">
        <h1 className="text-lg font-semibold text-gray-800">
          Auto Fill Rules
        </h1>
        <p className="text-xs text-gray-500">
          Create and manage automation rules
        </p>
      </div>

      <Tabs value={whichForm} onValueChange={setWhichForm}>
        <TabsList className="px-3">
          <TabsTrigger value="group">Create Group</TabsTrigger>
          <TabsTrigger value="rule">Create Rule</TabsTrigger>
        </TabsList>

        <TabsContent value="group">
          <RuleGroupForm onClose={() => setWhichForm('rule')} />
        </TabsContent>

        <TabsContent value="rule">
          <RuleElementForm onOpen={() => setWhichForm('group')} />
        </TabsContent>
      </Tabs>

      <div className="py-2"></div>

      <Tabs value={show} onValueChange={setShow}>
        <TabsList className="px-3">
          <TabsTrigger value="groups">Saved Groups</TabsTrigger>
          <TabsTrigger value="rules">Saved Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <SavedGroups />
        </TabsContent>

        <TabsContent value="rules">
          <SavedRules />
        </TabsContent>
      </Tabs>
    </>
  )
}
