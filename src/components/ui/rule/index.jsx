import { useEffect, useState } from "react";
import RuleGroupForm from "../group/Group";
import SavedRules from "./Saved";
import SavedGroups from "../group/Saved";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../shared/Tab";
import Encrypt from "../encrypt/Encrypt";
import Parser from "../parser";

const ACTIVE_FORM_TAB_KEY = "activeFormTab";
const FORM_TABS = new Set(["group", "encrypt", "parser"]);

export default function AutoFillRules() {
  const [show, setShow] = useState('groups');
  const [whichForm, setWhichForm] = useState(null);

  useEffect(() => {
    chrome.storage.local.get(ACTIVE_FORM_TAB_KEY).then((result) => {
      const savedTab = result?.[ACTIVE_FORM_TAB_KEY];
      setWhichForm(FORM_TABS.has(savedTab) ? savedTab : "encrypt");
    }).catch(() => {
      setWhichForm("encrypt");
    });
  }, []);

  function handleFormTabChange(tab) {
    if (!FORM_TABS.has(tab)) return;

    setWhichForm(tab);
    chrome.storage.local.set({ [ACTIVE_FORM_TAB_KEY]: tab });
  }

  return (
    <>
      <section aria-labelledby="auto-fill-heading">
        <div className="text-center py-3">
          <h1 id="auto-fill-heading" className="text-lg font-semibold text-gray-800">
            Auto Fill
          </h1>
        </div>

        <Tabs value={whichForm} onValueChange={handleFormTabChange}>
          <TabsList className="px-3">
            <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
            <TabsTrigger value="group">Group</TabsTrigger>
            <TabsTrigger value="parser">Parser</TabsTrigger>
          </TabsList>

          <TabsContent value="group">
            <RuleGroupForm onClose={() => handleFormTabChange('parser')} />
          </TabsContent>

          <TabsContent value="encrypt">
            <Encrypt />
          </TabsContent>

          <TabsContent value="parser">
            <Parser onOpen={() => handleFormTabChange("group")} />
          </TabsContent>

        </Tabs>

      </section>

      <section aria-label="Saved automation" className="mt-4">

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
      </section>
    </>
  )
}
