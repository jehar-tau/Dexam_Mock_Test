export const questionSchema={type:"object",additionalProperties:false,required:["externalKey","type","prompt","options","answer","explanation","topic","difficulty","estimatedSeconds","visualDependency","licence","sourceKind","holds","provenance"],properties:{externalKey:{type:"string"},type:{enum:["MCQ","MSQ","NAT","DESCRIPTIVE"]},prompt:{type:"string"},options:{type:"array",items:{type:"object",additionalProperties:false,required:["id","text"],properties:{id:{type:"string"},text:{type:"string"}}}},answer:{anyOf:[{type:"string"},{type:"array",items:{type:"string"}},{type:"null"}]},explanation:{type:"string"},topic:{type:"string"},difficulty:{enum:["easy","medium","hard","unassessed"]},estimatedSeconds:{type:"integer"},visualDependency:{type:"boolean"},licence:{const:"original-ai-draft"},sourceKind:{const:"generated"},holds:{type:"array",items:{const:"ai-generated-human-review"}},provenance:{type:"object",additionalProperties:false,required:["basisExternalKeys","generationNote"],properties:{basisExternalKeys:{type:"array",items:{type:"string"}},generationNote:{type:"string"}}}}};
export function buildAiDraftRequest({ model, exam, topic, questionType, instruction, basis }) {
  return {
    model,
    input: [
      { role: "system", content: [
        "Create one original, self-contained design-entrance practice question with visualDependency set to false.",
        "Use references for skill and difficulty calibration. Write fresh wording, options and answers.",
        "For MCQ and MSQ, write exactly four distinct labelled options. Return one option ID for MCQ and an array of option IDs for MSQ.",
        "For NAT, return an exact decimal or an inclusive range such as 2.5 to 3.5, with no options.",
        "For DESCRIPTIVE, return a drawing prompt and rubric in the explanation, with no options and a null answer.",
        "Keep the requested type and topic, the basis external keys in order, and the mandatory human-review hold.",
      ].join(" ") },
      { role: "user", content: JSON.stringify({ exam, topic, questionType, instruction, basis }) },
    ],
    text: { format: { type: "json_schema", name: "dmocks_question_draft", strict: true, schema: questionSchema } },
  };
}
export function parseAiDraftResponse(response){for(const item of response?.output??[])for(const content of item?.content??[])if(content?.type==="output_text"&&typeof content.text==="string"){const payload=JSON.parse(content.text);if(JSON.stringify(payload.holds)!=='["ai-generated-human-review"]')throw new Error("AI response omitted the human-review hold");return payload}throw new Error("AI response did not contain structured output")}
