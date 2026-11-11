export const ltmTenderForms = {
  forms: {
    e_tender_submission_letter: {
      name: "e-Tender Submission Letter (Form e-PW2B-1)",
      encrypted: false,
      expectedFieldCount: null,
    },
    tenderer_information: {
      name: "Tenderer Information Form (Form e-PW2B-2)",
      encrypted: false,
      expectedFieldCount: 13,
      values: {
        personnel: {
          sl_no: "1",
          name: "Copy Enclosed",
          position: "Copy Enclosed",
          years_of_general_experience: "Copy Enclosed",
          years_of_specific_experience: "Copy Enclosed",
        },
        equipment: {
          type_of_equipment: "Copy Enclosed",
          condition: "Copy Enclosed",
          owned_leased_or_to_be_purchased: "Copy Enclosed",
        },
        financial_resources: {
          no: "1",
          source_of_financing: "Copy Enclosed",
          amount_available: "3000000",
        },
        tenderer_details: {
          tenderers_legal_title: "",
          tenderers_registered_address: "",
        },
      },
    },
    activity_form: {
      name: "Activity Form",
      encrypted: false,
      expectedFieldCount: 2,
      values: {
        activity: {
          duration_of_activity_start_days: "5",
          activity_duration_days: "50",
        },
      },
    },
    personnel_information: {
      name: "Personnel Information Form (Form e-PW2B-3)",
      encrypted: false,
      expectedFieldCount: 23,
      values: {
        professional_experience: {
          serial_no: "1",
          from: "Copy Enclosed",
          to: "Copy Enclosed",
          company_project_position_experience: "Copy Enclosed",
          project: "Copy Enclosed",
          position: "Copy Enclosed",
          relevant_technical_and_management_experience: "Copy Enclosed",
        },
        present_employment: {
          procuring_entity_name: "Copy Enclosed",
          procuring_entity_address: "Copy Enclosed",
          present_job_title: "Copy Enclosed",
          years_with_present_entity: "Copy Enclosed",
          telephone_number: "Copy Enclosed",
          fax_number: "Copy Enclosed",
          email_address: "Copy Enclosed",
          contact_person: "Copy Enclosed",
        },
        candidate_details: {
          proposed_position: "Copy Enclosed",
          proposed_position_type: "Prime Candidate",
          name: "Copy Enclosed",
          date_of_birth: "Copy Enclosed",
          years_overall_experience: "Copy Enclosed",
          national_id_number: "Copy Enclosed",
          years_of_employment_with_tenderer: "Copy Enclosed",
          professional_qualifications: "Copy Enclosed",
        },
      },
    },
    priced_bill_of_quantities: {
      name: "Priced Bill of Quantities (BOQ)",
      encrypted: false,
      expectedFieldCount: null,
      values: {
        select_fields: {
          all: "Yes",
        },
      },
    },
    tenderers_quoted_price: {
      name: "Tenderer's Quoted Price",
      encrypted: false,
      expectedFieldCount: 1,
      values: {
        quoted_price: {
          percentage: "-5",
        },
      },
    },
  },
};

export function restoreLtmForms(stored = {}) {
  return Object.fromEntries(Object.entries(ltmTenderForms.forms).map(([key, form]) => [
    key,
    form.values ? {
      ...form,
      values: Object.fromEntries(Object.entries(form.values).map(([section, fields]) => [
        section,
        Object.fromEntries(Object.entries(fields).map(([field, fallback]) => {
          const value = stored[key]?.values?.[section]?.[field];
          // Replace the old text placeholder in the candidate-type dropdown.
          const legacyCandidateType = key === "personnel_information"
            && section === "candidate_details" && field === "proposed_position_type"
            && typeof value === "string" && value.trim().toLowerCase() === "copy enclosed";
          return [field, typeof value === "string" && !legacyCandidateType ? value : fallback];
        })),
      ])),
    } : form,
  ]));
}
