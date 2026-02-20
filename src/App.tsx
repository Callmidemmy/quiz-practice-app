import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";


type SlideReference = {
  slideNumber: number;
  slideTitle?: string;
  section?: string;
  fileName?: string;
};

type QuestionBase = {
  id: string;
  prompt: string;
  explanation?: string;
  tags?: string[];
  slideRef?: SlideReference;
};

type McqOption = { id: string; text: string };

type McqQuestion = QuestionBase & {
  type: "mcq";
  options: McqOption[];
  answerId: string;
};

type MatchPair = { left: string; right: string };

type MatchQuestion = QuestionBase & {
  type: "match";
  pairs: MatchPair[];
};

type Question = McqQuestion | MatchQuestion;

type AppConfig = {
  title: string;
  instructions?: string;
  questions: Question[];
};

type Attempt = {
  questionId: string;
  type: Question["type"];
  isCorrect: boolean;
  chosenAnswerId?: string;
  chosenPairs?: Array<{ left: string; right: string }>;
  timestamp: number;
};

type SessionState = {
  config: AppConfig;
  settings: {
    shuffle: boolean;
    showExplanations: boolean;
    autoAdvance: boolean;
  };
  progress: {
    currentIndex: number;
    order: string[];
    answersById: Record<string, Attempt>;
    retryVersionById: Record<string, number>;
    startedAt: number;
    completedAt?: number;
  };
};

const STORAGE_KEY = "quizzer_vite_react_ts_v2";

const sampleConfig: AppConfig = {
  "title": "Diabetes Mellitus Comprehensive Question Bank",
  "instructions": "Select the best answer for each question. Questions are derived exclusively from slide content.",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "Diabetes mellitus is best described as a group of metabolic conditions involving a malfunction in which of the following?",
      "slideRef": { "slideNumber": 2, "slideTitle": "Diabetes Mellitus", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "The way the body produces glucose" },
        { "id": "b", "text": "The way the body produces insulin, uses insulin, or both" },
        { "id": "c", "text": "The way the kidneys filter blood sugar" },
        { "id": "d", "text": "The way the liver stores glycogen" }
      ],
      "answerId": "b",
      "explanation": "Diabetes is defined as a malfunction in the way the body either produces insulin, uses insulin, or both."
    },
    {
      "id": "q2",
      "type": "mcq",
      "prompt": "Which organ is responsible for producing insulin?",
      "slideRef": { "slideNumber": 2, "slideTitle": "Diabetes Mellitus", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Liver" },
        { "id": "b", "text": "Kidney" },
        { "id": "c", "text": "Pancreas" },
        { "id": "d", "text": "Gallbladder" }
      ],
      "answerId": "c",
      "explanation": "The pancreas makes insulin."
    },
    {
      "id": "q3",
      "type": "mcq",
      "prompt": "What is the primary function of insulin in the body?",
      "slideRef": { "slideNumber": 2, "slideTitle": "Diabetes Mellitus", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "To break down fats for energy" },
        { "id": "b", "text": "To transport glucose from food into the body's cells to be used for energy" },
        { "id": "c", "text": "To filter waste products from the blood" },
        { "id": "d", "text": "To produce red blood cells" }
      ],
      "answerId": "b",
      "explanation": "Insulin is a hormone that helps transport glucose from food into the body's cells to be used for energy and helps regulate glucose levels."
    },
    {
      "id": "q4",
      "type": "mcq",
      "prompt": "In diabetes, blood glucose levels go way above normal (hyperglycemia) or way below normal, which is termed:",
      "slideRef": { "slideNumber": 2, "slideTitle": "Diabetes Mellitus", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Polyphagia" },
        { "id": "b", "text": "Hypoglycemia" },
        { "id": "c", "text": "Polyuria" },
        { "id": "d", "text": "Nephropathy" }
      ],
      "answerId": "b",
      "explanation": "Diabetes causes blood glucose levels to go way above (hyperglycemia) or below normal (hypoglycemia)."
    },
    {
      "id": "q5",
      "type": "mcq",
      "prompt": "According to the American Diabetes Association, which of the following is NOT one of the four general categories of diabetes?",
      "slideRef": { "slideNumber": 3, "slideTitle": "Types of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Type 1 diabetes" },
        { "id": "b", "text": "Type 2 diabetes" },
        { "id": "c", "text": "Type 3 diabetes" },
        { "id": "d", "text": "Gestational diabetes mellitus" }
      ],
      "answerId": "c",
      "explanation": "The ADA classifies diabetes into Type 1, Type 2, Gestational diabetes mellitus (GDM), and specific types due to other causes. Type 3 is not an official ADA category."
    },
    {
      "id": "q6",
      "type": "mcq",
      "prompt": "Type 1 diabetes is characterized as a condition of:",
      "slideRef": { "slideNumber": 4, "slideTitle": "Type 1 Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Complete or absolute insulin deficiency" },
        { "id": "b", "text": "Insulin resistance with adequate insulin production" },
        { "id": "c", "text": "Progressive loss of beta-cell insulin secretion" },
        { "id": "d", "text": "Hormonal interference during pregnancy" }
      ],
      "answerId": "a",
      "explanation": "Type 1 diabetes is defined as a condition of complete or absolute insulin deficiency."
    },
    {
      "id": "q7",
      "type": "mcq",
      "prompt": "What percentage of all diagnosed adult diabetes cases does Type 1 diabetes account for?",
      "slideRef": { "slideNumber": 4, "slideTitle": "Type 1 Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "20%–30%" },
        { "id": "b", "text": "5%–10%" },
        { "id": "c", "text": "50%–60%" },
        { "id": "d", "text": "90%–95%" }
      ],
      "answerId": "b",
      "explanation": "In adults, Type 1 diabetes accounts for approximately 5%–10% of all diagnosed cases."
    },
    {
      "id": "q8",
      "type": "mcq",
      "prompt": "Approximately how many youth are newly diagnosed with Type 1 diabetes each year?",
      "slideRef": { "slideNumber": 4, "slideTitle": "Type 1 Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Just over 5,000" },
        { "id": "b", "text": "Just over 18,000" },
        { "id": "c", "text": "Just over 38,000" },
        { "id": "d", "text": "Just over 98,000" }
      ],
      "answerId": "b",
      "explanation": "Type 1 diabetes occurs most frequently in children, with just over 18,000 youth newly diagnosed each year."
    },
    {
      "id": "q9",
      "type": "mcq",
      "prompt": "How quickly can Type 1 diabetes symptoms develop?",
      "slideRef": { "slideNumber": 4, "slideTitle": "Type 1 Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Over many years, slowly and progressively" },
        { "id": "b", "text": "In just a few weeks or months" },
        { "id": "c", "text": "Only after age 45" },
        { "id": "d", "text": "Only during pregnancy" }
      ],
      "answerId": "b",
      "explanation": "Type 1 symptoms can develop in just a few weeks or months, and once symptoms appear, they can be abruptly severe."
    },
    {
      "id": "q10",
      "type": "mcq",
      "prompt": "The underlying cause of Type 1 diabetes is best described as:",
      "slideRef": { "slideNumber": 6, "slideTitle": "Type 1 Diabetes Etiology", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Insulin resistance due to obesity" },
        { "id": "b", "text": "An autoimmune reaction that destroys insulin-producing beta cells in the pancreas" },
        { "id": "c", "text": "Hormones blocking insulin during pregnancy" },
        { "id": "d", "text": "A single gene mutation affecting insulin secretion" }
      ],
      "answerId": "b",
      "explanation": "Type 1 diabetes etiology is an autoimmune reaction that destroys the insulin-producing beta cells in the pancreas."
    },
    {
      "id": "q11",
      "type": "mcq",
      "prompt": "Which of the following has been supported by studies as a potential environmental trigger for Type 1 diabetes development?",
      "slideRef": { "slideNumber": 6, "slideTitle": "Type 1 Diabetes Etiology", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "High blood pressure" },
        { "id": "b", "text": "Viral infection" },
        { "id": "c", "text": "Steroid use" },
        { "id": "d", "text": "Excess abdominal fat" }
      ],
      "answerId": "b",
      "explanation": "The relationship between viral infection and Type 1 diabetes development is supported by many studies, indicating that viruses have the potential to induce beta-cell damage and reduce insulin production."
    },
    {
      "id": "q12",
      "type": "mcq",
      "prompt": "Type 2 diabetes is best described as a condition where the body does not use insulin properly due to:",
      "slideRef": { "slideNumber": 7, "slideTitle": "Type 2 Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Complete autoimmune destruction of beta cells" },
        { "id": "b", "text": "A progressive loss of adequate beta-cell insulin secretion" },
        { "id": "c", "text": "Hormones produced during pregnancy" },
        { "id": "d", "text": "A single gene mutation" }
      ],
      "answerId": "b",
      "explanation": "Type 2 diabetes is a condition where the body does not use insulin properly due to a progressive loss of adequate beta-cell insulin secretion."
    },
    {
      "id": "q13",
      "type": "mcq",
      "prompt": "What percentage of all diabetes cases does Type 2 diabetes account for?",
      "slideRef": { "slideNumber": 7, "slideTitle": "Type 2 Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "5%–10%" },
        { "id": "b", "text": "50%–60%" },
        { "id": "c", "text": "90%–95%" },
        { "id": "d", "text": "30%–40%" }
      ],
      "answerId": "c",
      "explanation": "Type 2 diabetes accounts for 90%–95% of all cases of diabetes."
    },
    {
      "id": "q14",
      "type": "mcq",
      "prompt": "In Type 2 diabetes, insulin resistance means:",
      "slideRef": { "slideNumber": 7, "slideTitle": "Type 2 Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "The pancreas produces no insulin at all" },
        { "id": "b", "text": "The body cannot use insulin well" },
        { "id": "c", "text": "Immune cells destroy beta cells" },
        { "id": "d", "text": "The kidneys filter too much glucose" }
      ],
      "answerId": "b",
      "explanation": "Insulin resistance is when the body cannot use insulin well. The body then needs more insulin to help glucose enter cells."
    },
    {
      "id": "q15",
      "type": "mcq",
      "prompt": "Which of the following is a modifiable risk factor for Type 2 diabetes?",
      "slideRef": { "slideNumber": 9, "slideTitle": "Type 2 Diabetes Etiology", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Age" },
        { "id": "b", "text": "Ethnicity" },
        { "id": "c", "text": "Obesity" },
        { "id": "d", "text": "Family history" }
      ],
      "answerId": "c",
      "explanation": "Obesity is a modifiable risk factor. Age, ethnicity, and family history are non-modifiable risk factors for Type 2 diabetes."
    },
    {
      "id": "q16",
      "type": "mcq",
      "prompt": "Extra-abdominal fat is specifically associated with which Type 2 diabetes risk factor?",
      "slideRef": { "slideNumber": 9, "slideTitle": "Type 2 Diabetes Etiology", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Retinopathy" },
        { "id": "b", "text": "Insulin resistance" },
        { "id": "c", "text": "Autonomic neuropathy" },
        { "id": "d", "text": "Nephropathy" }
      ],
      "answerId": "b",
      "explanation": "Body fat location and distribution, in particular extra-abdominal fat, is associated with insulin resistance."
    },
    {
      "id": "q17",
      "type": "mcq",
      "prompt": "Although Type 2 diabetes can develop at any age, it most often occurs in adults aged:",
      "slideRef": { "slideNumber": 9, "slideTitle": "Type 2 Diabetes Etiology", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "18–25 years" },
        { "id": "b", "text": "25–35 years" },
        { "id": "c", "text": "45 years or older" },
        { "id": "d", "text": "Under 20 years" }
      ],
      "answerId": "c",
      "explanation": "Although individuals can develop Type 2 diabetes at any point in time, even during childhood, it most often occurs in middle-aged and older adults 45 years or older."
    },
    {
      "id": "q18",
      "type": "match",
      "prompt": "Match each type of diabetes with its distinguishing characteristic.",
      "slideRef": { "slideNumber": 11, "slideTitle": "Type 1 vs Type 2 Cont.", "fileName": "Diabetes.pdf" },
      "pairs": [
        { "left": "Type 1 Diabetes", "right": "Body doesn't make enough insulin; caused by immune system reaction" },
        { "left": "Type 2 Diabetes", "right": "Body doesn't respond to insulin; lifestyle factors and genetics contribute" },
        { "left": "Type 1 onset", "right": "Symptoms come on quickly; often starts in childhood" },
        { "left": "Type 2 onset", "right": "Symptoms develop slowly; more common in middle age" }
      ],
      "explanation": "Type 1 is autoimmune with rapid symptom onset; Type 2 involves insulin resistance with slow symptom development."
    },
    {
      "id": "q19",
      "type": "mcq",
      "prompt": "Type 1 diabetes is treated with:",
      "slideRef": { "slideNumber": 11, "slideTitle": "Type 1 vs Type 2 Cont.", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Drugs and lifestyle changes" },
        { "id": "b", "text": "Insulin injections" },
        { "id": "c", "text": "Metformin only" },
        { "id": "d", "text": "Diet changes alone" }
      ],
      "answerId": "b",
      "explanation": "Type 1 diabetes is treated with insulin injections, while Type 2 is managed with drugs and lifestyle changes."
    },
    {
      "id": "q20",
      "type": "mcq",
      "prompt": "Gestational diabetes is typically diagnosed during which trimester(s) of pregnancy?",
      "slideRef": { "slideNumber": 12, "slideTitle": "Gestational Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "First trimester only" },
        { "id": "b", "text": "Second or third trimester" },
        { "id": "c", "text": "Third trimester only" },
        { "id": "d", "text": "Immediately after delivery" }
      ],
      "answerId": "b",
      "explanation": "Gestational diabetes is typically diagnosed in the second or third trimester of pregnancy."
    },
    {
      "id": "q21",
      "type": "mcq",
      "prompt": "What percentage of pregnancies in the United States are affected by gestational diabetes each year?",
      "slideRef": { "slideNumber": 12, "slideTitle": "Gestational Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Less than 1%" },
        { "id": "b", "text": "2%–10%" },
        { "id": "c", "text": "20%–30%" },
        { "id": "d", "text": "50%" }
      ],
      "answerId": "b",
      "explanation": "Every year, 2%–10% of pregnancies in the United States are affected by gestational diabetes."
    },
    {
      "id": "q22",
      "type": "mcq",
      "prompt": "Approximately what percentage of women with gestational diabetes will eventually develop Type 2 diabetes?",
      "slideRef": { "slideNumber": 12, "slideTitle": "Gestational Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "10%" },
        { "id": "b", "text": "25%" },
        { "id": "c", "text": "50%" },
        { "id": "d", "text": "90%" }
      ],
      "answerId": "c",
      "explanation": "About 50% of women with gestational diabetes will eventually develop Type 2 diabetes."
    },
    {
      "id": "q23",
      "type": "mcq",
      "prompt": "Neonatal diabetes mellitus (NDM) occurs in up to 1 in how many infants?",
      "slideRef": { "slideNumber": 14, "slideTitle": "Other Specific Types of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "1 in 40,000" },
        { "id": "b", "text": "1 in 400,000" },
        { "id": "c", "text": "1 in 4,000" },
        { "id": "d", "text": "1 in 4,000,000" }
      ],
      "answerId": "b",
      "explanation": "NDM is a rare condition that occurs in up to 1 in 400,000 infants in the first 6–12 months of life."
    },
    {
      "id": "q24",
      "type": "mcq",
      "prompt": "NDM is often mistaken for which type of diabetes?",
      "slideRef": { "slideNumber": 14, "slideTitle": "Other Specific Types of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Type 2 diabetes" },
        { "id": "b", "text": "Gestational diabetes" },
        { "id": "c", "text": "Type 1 diabetes" },
        { "id": "d", "text": "MODY" }
      ],
      "answerId": "c",
      "explanation": "NDM is often mistaken for Type 1 diabetes."
    },
    {
      "id": "q25",
      "type": "mcq",
      "prompt": "MODY (maturity-onset diabetes of the young) is characterized by onset of hyperglycemia typically before age:",
      "slideRef": { "slideNumber": 14, "slideTitle": "Other Specific Types of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "10" },
        { "id": "b", "text": "18" },
        { "id": "c", "text": "25" },
        { "id": "d", "text": "45" }
      ],
      "answerId": "c",
      "explanation": "MODY is characterized by onset of hyperglycemia due to impaired insulin secretion at an early age, typically before age 25."
    },
    {
      "id": "q26",
      "type": "mcq",
      "prompt": "MODY accounts for up to what percentage of all cases of diabetes in the United States in people ages 20 and younger?",
      "slideRef": { "slideNumber": 14, "slideTitle": "Other Specific Types of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Up to 10%" },
        { "id": "b", "text": "Up to 2%" },
        { "id": "c", "text": "Up to 5%" },
        { "id": "d", "text": "Up to 30%" }
      ],
      "answerId": "b",
      "explanation": "MODY accounts for up to 2% of all cases of diabetes in the United States in people ages 20 and younger."
    },
    {
      "id": "q27",
      "type": "mcq",
      "prompt": "What informal term is used to describe insulin resistance that occurs specifically in the brain?",
      "slideRef": { "slideNumber": 15, "slideTitle": "Diabetes Type 3", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Diabetic neuropathy" },
        { "id": "b", "text": "Type 3 diabetes" },
        { "id": "c", "text": "MODY" },
        { "id": "d", "text": "Gestational diabetes" }
      ],
      "answerId": "b",
      "explanation": "'Type 3 diabetes' is an informal term used to describe insulin resistance that occurs specifically in the brain."
    },
    {
      "id": "q28",
      "type": "mcq",
      "prompt": "Type 3 diabetes is most commonly linked to which condition?",
      "slideRef": { "slideNumber": 15, "slideTitle": "Diabetes Type 3", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Kidney failure" },
        { "id": "b", "text": "Cardiovascular disease" },
        { "id": "c", "text": "Alzheimer's disease and other neurodegenerative conditions" },
        { "id": "d", "text": "Retinopathy" }
      ],
      "answerId": "c",
      "explanation": "Type 3 diabetes is most commonly linked to Alzheimer's disease and other neurodegenerative conditions."
    },
    {
      "id": "q29",
      "type": "mcq",
      "prompt": "Reduced insulin signaling in the brain contributes to the accumulation of which proteins?",
      "slideRef": { "slideNumber": 15, "slideTitle": "Diabetes Type 3", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Ketone bodies and glucose" },
        { "id": "b", "text": "Beta-amyloid plaques and tau protein" },
        { "id": "c", "text": "LDL and HDL cholesterol" },
        { "id": "d", "text": "Albumin and creatinine" }
      ],
      "answerId": "b",
      "explanation": "Reduced insulin signaling contributes to accumulation of beta-amyloid plaques and tau protein changes."
    },
    {
      "id": "q30",
      "type": "mcq",
      "prompt": "Is Type 3 diabetes currently recognized as an official diabetes diagnosis?",
      "slideRef": { "slideNumber": 15, "slideTitle": "Diabetes Type 3", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Yes, it is recognized by the ADA" },
        { "id": "b", "text": "Yes, it is recognized by the WHO only" },
        { "id": "c", "text": "No, but it is widely discussed in neuroscience and metabolic research" },
        { "id": "d", "text": "No, and it is not discussed in any medical research" }
      ],
      "answerId": "c",
      "explanation": "Type 3 diabetes is not currently recognized as an official diabetes diagnosis, but is widely discussed in neuroscience and metabolic research."
    },
    {
      "id": "q31",
      "type": "mcq",
      "prompt": "The fasting glucose level range for prediabetes is:",
      "slideRef": { "slideNumber": 16, "slideTitle": "Prediabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Below 70 mg/dL" },
        { "id": "b", "text": "100–125 mg/dL" },
        { "id": "c", "text": "126 mg/dL or above" },
        { "id": "d", "text": "180 mg/dL or above" }
      ],
      "answerId": "b",
      "explanation": "Individuals in the prediabetes zone present with impaired fasting glucose levels of 100–125 mg/dL."
    },
    {
      "id": "q32",
      "type": "mcq",
      "prompt": "The glucose tolerance level range for prediabetes is:",
      "slideRef": { "slideNumber": 16, "slideTitle": "Prediabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Below 100 mg/dL" },
        { "id": "b", "text": "126–139 mg/dL" },
        { "id": "c", "text": "140–199 mg/dL" },
        { "id": "d", "text": "200 mg/dL or above" }
      ],
      "answerId": "c",
      "explanation": "Prediabetes is characterized by impaired glucose tolerance levels of 140–199 mg/dL."
    },
    {
      "id": "q33",
      "type": "mcq",
      "prompt": "Prediabetes is associated with all of the following EXCEPT:",
      "slideRef": { "slideNumber": 16, "slideTitle": "Prediabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Obesity" },
        { "id": "b", "text": "Dyslipidemia" },
        { "id": "c", "text": "Hypertension" },
        { "id": "d", "text": "Retinopathy" }
      ],
      "answerId": "d",
      "explanation": "The slide lists prediabetes as associated with obesity, dyslipidemia, and hypertension. Retinopathy is a complication of established diabetes, not listed as associated with prediabetes."
    },
    {
      "id": "q34",
      "type": "mcq",
      "prompt": "How many million people in the United States have diabetes?",
      "slideRef": { "slideNumber": 17, "slideTitle": "Diabetes in the US", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "18 million" },
        { "id": "b", "text": "38 million" },
        { "id": "c", "text": "98 million" },
        { "id": "d", "text": "128 million" }
      ],
      "answerId": "b",
      "explanation": "38 million people have diabetes in the US, which is about 1 in every 10 people."
    },
    {
      "id": "q35",
      "type": "mcq",
      "prompt": "How many million American adults have prediabetes?",
      "slideRef": { "slideNumber": 17, "slideTitle": "Diabetes in the US", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "38 million" },
        { "id": "b", "text": "68 million" },
        { "id": "c", "text": "98 million" },
        { "id": "d", "text": "120 million" }
      ],
      "answerId": "c",
      "explanation": "98 million American adults — more than 1 in 3 — have prediabetes."
    },
    {
      "id": "q36",
      "type": "mcq",
      "prompt": "What fraction of people with diabetes do not know they have it?",
      "slideRef": { "slideNumber": 17, "slideTitle": "Diabetes in the US", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "1 in 10" },
        { "id": "b", "text": "1 in 5" },
        { "id": "c", "text": "1 in 3" },
        { "id": "d", "text": "1 in 2" }
      ],
      "answerId": "b",
      "explanation": "1 in 5 people with diabetes don't know they have it."
    },
    {
      "id": "q37",
      "type": "mcq",
      "prompt": "What fraction of adults with prediabetes don't know they have it?",
      "slideRef": { "slideNumber": 17, "slideTitle": "Diabetes in the US", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "More than 1 in 5" },
        { "id": "b", "text": "More than 1 in 3" },
        { "id": "c", "text": "More than 8 in 10" },
        { "id": "d", "text": "More than 5 in 10" }
      ],
      "answerId": "c",
      "explanation": "More than 8 in 10 adults with prediabetes don't know they have it."
    },
    {
      "id": "q38",
      "type": "mcq",
      "prompt": "What is the total medical cost and lost work and wages figure associated with diagnosed diabetes in the US?",
      "slideRef": { "slideNumber": 18, "slideTitle": "Diabetes in the US Cont.", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "$98 billion" },
        { "id": "b", "text": "$213 billion" },
        { "id": "c", "text": "$413 billion" },
        { "id": "d", "text": "$513 billion" }
      ],
      "answerId": "c",
      "explanation": "$413 billion is the total medical costs and lost work and wages for people with diagnosed diabetes."
    },
    {
      "id": "q39",
      "type": "mcq",
      "prompt": "Medical costs for people with diabetes are how much higher compared to people without diabetes?",
      "slideRef": { "slideNumber": 18, "slideTitle": "Diabetes in the US Cont.", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "50% higher" },
        { "id": "b", "text": "Twice as high" },
        { "id": "c", "text": "Three times as high" },
        { "id": "d", "text": "Four times as high" }
      ],
      "answerId": "b",
      "explanation": "Medical costs for people with diabetes are more than twice as high as for people without diabetes."
    },
    {
      "id": "q40",
      "type": "mcq",
      "prompt": "Hypoglycemia is defined as blood sugar that drops below:",
      "slideRef": { "slideNumber": 22, "slideTitle": "Hypoglycemia", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "100 mg/dL" },
        { "id": "b", "text": "70 mg/dL" },
        { "id": "c", "text": "125 mg/dL" },
        { "id": "d", "text": "180 mg/dL" }
      ],
      "answerId": "b",
      "explanation": "Hypoglycemia is low blood sugar that drops below 70 mg/dL, requiring immediate treatment."
    },
    {
      "id": "q41",
      "type": "mcq",
      "prompt": "Which of the following is listed as a risk factor for hypoglycemia?",
      "slideRef": { "slideNumber": 22, "slideTitle": "Hypoglycemia", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Eating too many carbohydrates" },
        { "id": "b", "text": "Drinking too much alcohol without enough food" },
        { "id": "c", "text": "Decreasing physical activity" },
        { "id": "d", "text": "Taking fewer medications" }
      ],
      "answerId": "b",
      "explanation": "Drinking too much alcohol without enough food is listed as a risk factor for hypoglycemia, along with skipping meals, not eating enough carbohydrates, and increasing physical activity."
    },
    {
      "id": "q42",
      "type": "match",
      "prompt": "Match the hypoglycemia symptom to its severity category.",
      "slideRef": { "slideNumber": 23, "slideTitle": "Symptoms of Hypoglycemia", "fileName": "Diabetes.pdf" },
      "pairs": [
        { "left": "Shaky or jittery", "right": "Mild to Moderate" },
        { "left": "Seizures or convulsions", "right": "Severe" },
        { "left": "Unconsciousness", "right": "Severe" },
        { "left": "Fast or irregular heartbeat", "right": "Mild to Moderate" }
      ],
      "explanation": "Severe hypoglycemia includes inability to eat or drink, seizures/convulsions, and unconsciousness. Mild to moderate includes shakiness, irritability, sweating, confusion, fast heartbeat, dizziness, hunger, nausea, and pallor."
    },
    {
      "id": "q43",
      "type": "mcq",
      "prompt": "Which of the following is classified as a SEVERE symptom of hypoglycemia?",
      "slideRef": { "slideNumber": 23, "slideTitle": "Symptoms of Hypoglycemia", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Pallor or pale skin" },
        { "id": "b", "text": "Hunger" },
        { "id": "c", "text": "Unconsciousness" },
        { "id": "d", "text": "Blurred or impaired vision" }
      ],
      "answerId": "c",
      "explanation": "Unconsciousness is listed as a severe symptom of hypoglycemia. Pallor, hunger, and blurred vision are mild to moderate symptoms."
    },
    {
      "id": "q44",
      "type": "mcq",
      "prompt": "Hyperglycemia while fasting is defined as blood sugar above:",
      "slideRef": { "slideNumber": 25, "slideTitle": "Hyperglycemia", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "70 mg/dL" },
        { "id": "b", "text": "100 mg/dL" },
        { "id": "c", "text": "125 mg/dL" },
        { "id": "d", "text": "180 mg/dL" }
      ],
      "answerId": "c",
      "explanation": "Hyperglycemia is defined as above 125 mg/dL while fasting or 180 mg/dL 1–2 hours after eating."
    },
    {
      "id": "q45",
      "type": "mcq",
      "prompt": "Hyperglycemia 1–2 hours after eating is defined as blood sugar above:",
      "slideRef": { "slideNumber": 25, "slideTitle": "Hyperglycemia", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "70 mg/dL" },
        { "id": "b", "text": "125 mg/dL" },
        { "id": "c", "text": "180 mg/dL" },
        { "id": "d", "text": "200 mg/dL" }
      ],
      "answerId": "c",
      "explanation": "Hyperglycemia is above 180 mg/dL 1–2 hours after eating."
    },
    {
      "id": "q46",
      "type": "match",
      "prompt": "Match the clinical term to its meaning as a warning sign of diabetes.",
      "slideRef": { "slideNumber": 32, "slideTitle": "Warning Signs of Diabetes", "fileName": "Diabetes.pdf" },
      "pairs": [
        { "left": "Polyuria", "right": "Frequent urination" },
        { "left": "Polydipsia", "right": "Increased thirst" },
        { "left": "Polyphagia", "right": "Increased hunger" }
      ],
      "explanation": "The three Ps of diabetes: Polyuria (frequent urination), Polydipsia (increased thirst), and Polyphagia (increased hunger)."
    },
    {
      "id": "q47",
      "type": "mcq",
      "prompt": "The classic warning signs of diabetes are known as the '3 P's.' Which set correctly lists all three?",
      "slideRef": { "slideNumber": 32, "slideTitle": "Warning Signs of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Polyuria, Polydipsia, Polyphagia" },
        { "id": "b", "text": "Polyuria, Pallor, Polyphagia" },
        { "id": "c", "text": "Polydipsia, Peripheral neuropathy, Polyuria" },
        { "id": "d", "text": "Polyphagia, Proteinuria, Polydipsia" }
      ],
      "answerId": "a",
      "explanation": "The 3 P's of diabetes are Polyuria (frequent urination), Polydipsia (increased thirst), and Polyphagia (increased hunger)."
    },
    {
      "id": "q48",
      "type": "mcq",
      "prompt": "Which type of diabetes onset often leads patients to seek medical attention after their first experience with DKA?",
      "slideRef": { "slideNumber": 33, "slideTitle": "Diabetes Onset", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Type 2 diabetes" },
        { "id": "b", "text": "Gestational diabetes" },
        { "id": "c", "text": "Type 1 diabetes" },
        { "id": "d", "text": "MODY" }
      ],
      "answerId": "c",
      "explanation": "Type 1 diabetes patients often seek medical attention after their first experience of DKA, which is a medical emergency."
    },
    {
      "id": "q49",
      "type": "mcq",
      "prompt": "A patient with Type 2 diabetes may first experience symptoms associated with prediabetes, which include all of the following EXCEPT:",
      "slideRef": { "slideNumber": 33, "slideTitle": "Diabetes Onset", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Extreme hunger and thirst" },
        { "id": "b", "text": "Slow healing cuts and bruises" },
        { "id": "c", "text": "Blurred vision" },
        { "id": "d", "text": "Seizures" }
      ],
      "answerId": "d",
      "explanation": "Type 2 onset symptoms include extreme hunger, thirst, fatigue, slow healing cuts and bruises, and blurred vision. Seizures are listed as a severe symptom of hypoglycemia, not Type 2 onset."
    },
    {
      "id": "q50",
      "type": "match",
      "prompt": "Match the diagnostic test to its normal, prediabetes, and Type 2 diabetes values.",
      "slideRef": { "slideNumber": 34, "slideTitle": "Measure Glucose Levels", "fileName": "Diabetes.pdf" },
      "pairs": [
        { "left": "HbA1c — Normal", "right": "4–5.6%" },
        { "left": "HbA1c — Prediabetes", "right": "5.7–6.4%" },
        { "left": "Fasting Blood Glucose — Type 2 Diabetes", "right": "126+ mg/dL" },
        { "left": "OGTT — Prediabetes", "right": "141–199 mg/dL" }
      ],
      "explanation": "These are the diagnostic thresholds used to classify glucose levels into normal, prediabetes, and Type 2 diabetes categories."
    },
    {
      "id": "q51",
      "type": "mcq",
      "prompt": "An HbA1c value of 6.5% or above indicates:",
      "slideRef": { "slideNumber": 34, "slideTitle": "Measure Glucose Levels", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Normal glucose" },
        { "id": "b", "text": "Prediabetes" },
        { "id": "c", "text": "Type 2 diabetes" },
        { "id": "d", "text": "Hypoglycemia" }
      ],
      "answerId": "c",
      "explanation": "An HbA1c of 6.5% or above indicates Type 2 diabetes. Normal is 4–5.6% and prediabetes is 5.7–6.4%."
    },
    {
      "id": "q52",
      "type": "mcq",
      "prompt": "On average, how many fewer years does a person with Type 1 diabetes live compared to the general population?",
      "slideRef": { "slideNumber": 35, "slideTitle": "Course and Prognosis", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "5 years less" },
        { "id": "b", "text": "10 years less" },
        { "id": "c", "text": "12 years less" },
        { "id": "d", "text": "20 years less" }
      ],
      "answerId": "c",
      "explanation": "Type 1 diabetes reduces life expectancy by 12 years on average compared to the general population."
    },
    {
      "id": "q53",
      "type": "mcq",
      "prompt": "On average, how many fewer years does a person with Type 2 diabetes live compared to the general population?",
      "slideRef": { "slideNumber": 35, "slideTitle": "Course and Prognosis", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "5 years less" },
        { "id": "b", "text": "10 years less" },
        { "id": "c", "text": "12 years less" },
        { "id": "d", "text": "15 years less" }
      ],
      "answerId": "b",
      "explanation": "Type 2 diabetes reduces life expectancy by 10 years on average."
    },
    {
      "id": "q54",
      "type": "match",
      "prompt": "Match each complication category with its examples.",
      "slideRef": { "slideNumber": 37, "slideTitle": "Major Complications of Diabetes", "fileName": "Diabetes.pdf" },
      "pairs": [
        { "left": "Microvascular – Eye", "right": "Retinopathy, cataracts, and glaucoma from high blood glucose and blood pressure damaging eye blood vessels" },
        { "left": "Microvascular – Kidney", "right": "Nephropathy from high blood pressure and excess blood glucose overworking the kidneys" },
        { "left": "Macrovascular – Brain", "right": "Increased risk of stroke, cerebrovascular disease, cognitive impairment" },
        { "left": "Macrovascular – Extremities", "right": "Peripheral vascular disease; reduced blood flow in legs; slow wound healing and gangrene" }
      ],
      "explanation": "Diabetes causes both microvascular (small vessel) and macrovascular (large vessel) complications affecting multiple organ systems."
    },
    {
      "id": "q55",
      "type": "mcq",
      "prompt": "Macrovascular complications of diabetes affect which system?",
      "slideRef": { "slideNumber": 38, "slideTitle": "Macrovascular Complications", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "The visual system only" },
        { "id": "b", "text": "The cardiovascular system, including HTN, CVD, cerebrovascular disease, and PAD" },
        { "id": "c", "text": "The peripheral nervous system only" },
        { "id": "d", "text": "The renal system only" }
      ],
      "answerId": "b",
      "explanation": "Macrovascular complications affect the cardiovascular system and include hypertension, CVD, cerebrovascular disease, and peripheral artery disease."
    },
    {
      "id": "q56",
      "type": "mcq",
      "prompt": "High blood sugar levels in diabetes can lead to which macrovascular condition involving plaque buildup in arteries?",
      "slideRef": { "slideNumber": 38, "slideTitle": "Macrovascular Complications", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Retinopathy" },
        { "id": "b", "text": "Atherosclerosis" },
        { "id": "c", "text": "Nephropathy" },
        { "id": "d", "text": "Gastroparesis" }
      ],
      "answerId": "b",
      "explanation": "High blood sugar levels leads to atherosclerosis, a macrovascular complication."
    },
    {
      "id": "q57",
      "type": "mcq",
      "prompt": "What is described as the most common complication of diabetes?",
      "slideRef": { "slideNumber": 39, "slideTitle": "Microvascular Complications", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Diabetic nephropathy" },
        { "id": "b", "text": "Peripheral neuropathy" },
        { "id": "c", "text": "Diabetic retinopathy" },
        { "id": "d", "text": "Peripheral artery disease" }
      ],
      "answerId": "c",
      "explanation": "Diabetic retinopathy is described as the most common complication of diabetes."
    },
    {
      "id": "q58",
      "type": "mcq",
      "prompt": "What percentage of people diagnosed with Type 1 or Type 2 diabetes will develop diabetic nephropathy?",
      "slideRef": { "slideNumber": 39, "slideTitle": "Microvascular Complications", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "5%–10%" },
        { "id": "b", "text": "10%–20%" },
        { "id": "c", "text": "30%–40%" },
        { "id": "d", "text": "50%–60%" }
      ],
      "answerId": "c",
      "explanation": "30%–40% of people diagnosed with Type 1 or Type 2 diabetes will develop diabetic nephropathy."
    },
    {
      "id": "q59",
      "type": "mcq",
      "prompt": "Diabetic nephropathy is listed as the leading cause of which condition in the United States?",
      "slideRef": { "slideNumber": 39, "slideTitle": "Microvascular Complications", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Blindness" },
        { "id": "b", "text": "End-stage renal disease" },
        { "id": "c", "text": "Stroke" },
        { "id": "d", "text": "Heart failure" }
      ],
      "answerId": "b",
      "explanation": "Diabetic nephropathy and diabetic kidney disease are the leading causes of end-stage renal disease in the United States."
    },
    {
      "id": "q60",
      "type": "mcq",
      "prompt": "Diabetic peripheral neuropathy affects approximately what proportion of all persons with diabetes?",
      "slideRef": { "slideNumber": 42, "slideTitle": "Neurologic Complications", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "About 10%" },
        { "id": "b", "text": "About 25%" },
        { "id": "c", "text": "About half" },
        { "id": "d", "text": "About 75%" }
      ],
      "answerId": "c",
      "explanation": "Diabetic peripheral neuropathy affects about half of all persons with diabetes."
    },
    {
      "id": "q61",
      "type": "mcq",
      "prompt": "Diabetic peripheral neuropathy typically follows which distribution pattern?",
      "slideRef": { "slideNumber": 42, "slideTitle": "Neurologic Complications", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Asymmetrical, proximal to distal" },
        { "id": "b", "text": "Symmetrical, 'stocking and glove' type, distal to proximal" },
        { "id": "c", "text": "Focal, affecting one extremity only" },
        { "id": "d", "text": "Central, affecting the trunk first" }
      ],
      "answerId": "b",
      "explanation": "Diabetic peripheral neuropathy is typically symmetrical and occurs in a 'stocking and glove' type distribution, beginning distally and progressing proximally."
    },
    {
      "id": "q62",
      "type": "mcq",
      "prompt": "Which of the following is a symptom of diabetic peripheral neuropathy listed in the slides?",
      "slideRef": { "slideNumber": 42, "slideTitle": "Neurologic Complications", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Polyuria" },
        { "id": "b", "text": "Gastroparesis" },
        { "id": "c", "text": "Burning, tingling, pain, numbness, or loss of protective sensation" },
        { "id": "d", "text": "Orthostatic hypotension" }
      ],
      "answerId": "c",
      "explanation": "Symptoms of diabetic peripheral neuropathy include burning, tingling, pain, numbness, and/or loss of protective sensation."
    },
    {
      "id": "q63",
      "type": "match",
      "prompt": "Match the type of diabetic autonomic neuropathy with its associated signs.",
      "slideRef": { "slideNumber": 44, "slideTitle": "Neurologic Complications of Diabetes", "fileName": "Diabetes.pdf" },
      "pairs": [
        { "left": "Cardiovascular autonomic neuropathy", "right": "Tachycardia, orthostatic hypotension, syncope" },
        { "left": "Gastrointestinal autonomic neuropathy", "right": "Gastroparesis, diarrhea, constipation, fecal incontinence" },
        { "left": "Genitourinary autonomic neuropathy", "right": "Erectile dysfunction, neurogenic bladder, female sexual dysfunction" },
        { "left": "Sudomotor autonomic neuropathy", "right": "Dry skin, lack of sweat, cracks on the skin" }
      ],
      "explanation": "Diabetic autonomic neuropathies affect the autonomic nerves innervating body organs and are categorized by organ system affected."
    },
    {
      "id": "q64",
      "type": "mcq",
      "prompt": "Gastroparesis, a gastrointestinal autonomic complication of diabetes, is defined as:",
      "slideRef": { "slideNumber": 44, "slideTitle": "Neurologic Complications of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Rapid gastric emptying causing diarrhea" },
        { "id": "b", "text": "Delayed gastric emptying causing cramping, bloating, nausea, and bowel irregularities" },
        { "id": "c", "text": "Excess stomach acid production" },
        { "id": "d", "text": "Loss of appetite due to hyperglycemia" }
      ],
      "answerId": "b",
      "explanation": "Gastroparesis, or delayed gastric emptying, can cause severe cramping, bloating, nausea, and bowel irregularities."
    },
    {
      "id": "q65",
      "type": "mcq",
      "prompt": "Diabetic foot ulcers are caused by a combination of factors including all of the following EXCEPT:",
      "slideRef": { "slideNumber": 47, "slideTitle": "Diabetic Foot Ulcers", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Peripheral neuropathy" },
        { "id": "b", "text": "Vascular complications" },
        { "id": "c", "text": "Weight on the lower extremity" },
        { "id": "d", "text": "Excess dietary carbohydrates" }
      ],
      "answerId": "d",
      "explanation": "Diabetic foot ulcers are caused by peripheral neuropathy, vascular complications, weight on the lower extremity, and activity levels. Excess dietary carbohydrates is not listed."
    },
    {
      "id": "q66",
      "type": "mcq",
      "prompt": "Which habit is listed as increasing the risk of diabetic foot ulcers?",
      "slideRef": { "slideNumber": 47, "slideTitle": "Diabetic Foot Ulcers", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Regular exercise" },
        { "id": "b", "text": "Smoking" },
        { "id": "c", "text": "Excessive alcohol intake" },
        { "id": "d", "text": "High carbohydrate diet" }
      ],
      "answerId": "b",
      "explanation": "Smoking increases the risk of diabetic foot ulcers."
    },
    {
      "id": "q67",
      "type": "mcq",
      "prompt": "Periodontal disease is caused by the presence of bacteria and results in chronic inflammation to the gums, periodontal ligaments, and:",
      "slideRef": { "slideNumber": 48, "slideTitle": "Periodontal Disease", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Peripheral nerves" },
        { "id": "b", "text": "Oral bones" },
        { "id": "c", "text": "Blood vessels" },
        { "id": "d", "text": "Retina" }
      ],
      "answerId": "b",
      "explanation": "Periodontal disease results in chronic inflammation to the gums, periodontal ligaments, and oral bones."
    },
    {
      "id": "q68",
      "type": "mcq",
      "prompt": "Diabetes distress refers to the psychological impact of living with a chronic condition and includes emotional responses to all of the following EXCEPT:",
      "slideRef": { "slideNumber": 46, "slideTitle": "Diabetes Distress", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Anxiety about existing or possible complications" },
        { "id": "b", "text": "Fear of hypoglycemia" },
        { "id": "c", "text": "Guilt for periods of poor self-management" },
        { "id": "d", "text": "Increased appetite from hyperglycemia" }
      ],
      "answerId": "d",
      "explanation": "Diabetes distress includes emotional responses to medications, dosing schedules, diet adherence, anxiety about complications, guilt, impact on family, and fear of hypoglycemia. Increased appetite is a symptom, not a component of diabetes distress."
    },
    {
      "id": "q69",
      "type": "mcq",
      "prompt": "Diabetic ketoacidosis (DKA) is classified as:",
      "slideRef": { "slideNumber": 29, "slideTitle": "Diabetic Ketoacidosis (DKA)", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "A chronic, slowly progressing complication" },
        { "id": "b", "text": "A diabetic emergency" },
        { "id": "c", "text": "A mild form of hyperglycemia" },
        { "id": "d", "text": "A type of autonomic neuropathy" }
      ],
      "answerId": "b",
      "explanation": "DKA is classified as a diabetic emergency."
    },
    {
      "id": "q70",
      "type": "mcq",
      "prompt": "Ketones are produced when there is not enough insulin to use glucose, and are made by the:",
      "slideRef": { "slideNumber": 29, "slideTitle": "Diabetic Ketoacidosis (DKA)", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Pancreas, from breaking down proteins" },
        { "id": "b", "text": "Kidneys, from filtering blood" },
        { "id": "c", "text": "Body's liver, from the breakdown of fats for energy" },
        { "id": "d", "text": "Muscles, from glycogen stores" }
      ],
      "answerId": "c",
      "explanation": "Ketones are made by the body's liver from the breakdown of fats for energy when there is not enough insulin to use glucose."
    },
    {
      "id": "q71",
      "type": "mcq",
      "prompt": "In DKA, the metabolic sequence is best described as:",
      "slideRef": { "slideNumber": 30, "slideTitle": "DKA Further Explained", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Low insulin → glucose enters cells → protein breakdown → DKA" },
        { "id": "b", "text": "Low insulin → glucose unavailable → fat breakdown → ketone production → blood acidification" },
        { "id": "c", "text": "High insulin → excess glucose stored → ketone buildup" },
        { "id": "d", "text": "Normal insulin → glucose unavailable → kidney failure" }
      ],
      "answerId": "b",
      "explanation": "The DKA sequence is: Low insulin → glucose unavailable → fat breakdown → ketone production → ketones build up too quickly → blood becomes acidic → DKA."
    },
    {
      "id": "q72",
      "type": "mcq",
      "prompt": "Which of the following is listed as a DKA warning sign?",
      "slideRef": { "slideNumber": 31, "slideTitle": "DKA Signs and Symptoms", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Slow heart rate" },
        { "id": "b", "text": "High level of ketones in the urine" },
        { "id": "c", "text": "Low blood pressure" },
        { "id": "d", "text": "Excessive sweating" }
      ],
      "answerId": "b",
      "explanation": "DKA warning signs include thirst or dry mouth, frequent urination, high blood glucose levels, and high level of ketones in the urine."
    },
    {
      "id": "q73",
      "type": "mcq",
      "prompt": "Which DKA symptom is listed as distinctive and detectable by smell?",
      "slideRef": { "slideNumber": 31, "slideTitle": "DKA Signs and Symptoms", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Dry or flushed skin" },
        { "id": "b", "text": "Nausea" },
        { "id": "c", "text": "Fruity odor on breath" },
        { "id": "d", "text": "Fatigue" }
      ],
      "answerId": "c",
      "explanation": "Fruity odor on breath is listed as a distinctive DKA symptom that is detectable by smell."
    },
    {
      "id": "q74",
      "type": "mcq",
      "prompt": "Blood glucose monitoring has been shown to improve A1C levels and decrease diabetic complications, particularly for which type of diabetes?",
      "slideRef": { "slideNumber": 50, "slideTitle": "Blood Glucose Monitoring", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Gestational diabetes" },
        { "id": "b", "text": "Type 1 diabetes" },
        { "id": "c", "text": "Type 2 diabetes managed with diet alone" },
        { "id": "d", "text": "Prediabetes" }
      ],
      "answerId": "b",
      "explanation": "Glucose monitoring has been shown to improve A1C levels and decrease diabetic complications for people with Type 1 diabetes."
    },
    {
      "id": "q75",
      "type": "mcq",
      "prompt": "How many times per day does a person with Type 1 diabetes typically test their blood sugar?",
      "slideRef": { "slideNumber": 51, "slideTitle": "Glucometer", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "1–2 times per day" },
        { "id": "b", "text": "2–3 times per day" },
        { "id": "c", "text": "4–10 times per day" },
        { "id": "d", "text": "Only once weekly" }
      ],
      "answerId": "c",
      "explanation": "Type 1 diabetes patients test their blood sugar 4–10 times per day."
    },
    {
      "id": "q76",
      "type": "mcq",
      "prompt": "A person with Type 1 diabetes should check blood sugar before which of the following activities?",
      "slideRef": { "slideNumber": 51, "slideTitle": "Glucometer", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Driving or travel" },
        { "id": "b", "text": "Showering" },
        { "id": "c", "text": "Sleeping only on weekends" },
        { "id": "d", "text": "Watching television" }
      ],
      "answerId": "a",
      "explanation": "Blood sugar should be checked before driving or travel, along with before/after meals, exercise, bedtime, when suspecting hypo/hyperglycemia, and while taking a new medication."
    },
    {
      "id": "q77",
      "type": "mcq",
      "prompt": "A Continuous Glucose Monitoring System (CGM) obtains real-time glucose readings from:",
      "slideRef": { "slideNumber": 52, "slideTitle": "Continuous Glucose Monitoring System", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Venous blood via IV catheter" },
        { "id": "b", "text": "Interstitial fluid via a small subcutaneous catheter" },
        { "id": "c", "text": "Urine via dipstick" },
        { "id": "d", "text": "Saliva via oral sensor" }
      ],
      "answerId": "b",
      "explanation": "A CGM uses a reusable transmitter and small subcutaneous catheter to obtain real-time glucose readings from interstitial fluid."
    },
    {
      "id": "q78",
      "type": "mcq",
      "prompt": "Which of the following is a benefit of the CGM system mentioned in the slides?",
      "slideRef": { "slideNumber": 52, "slideTitle": "Continuous Glucose Monitoring System", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Eliminates the need for any insulin" },
        { "id": "b", "text": "Helpful in decreasing hypoglycemic fear and diabetes-related stress" },
        { "id": "c", "text": "Replaces dietary management" },
        { "id": "d", "text": "Provides insulin dosing automatically without user input" }
      ],
      "answerId": "b",
      "explanation": "CGM is helpful in decreasing hypoglycemic fear and diabetes-related stress."
    },
    {
      "id": "q79",
      "type": "mcq",
      "prompt": "Why can insulin NOT be taken orally?",
      "slideRef": { "slideNumber": 55, "slideTitle": "Insulin Replacement", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "It causes severe stomach ulcers" },
        { "id": "b", "text": "Its proteins would be destroyed during the digestive process" },
        { "id": "c", "text": "It is too large to be absorbed through the intestinal wall" },
        { "id": "d", "text": "It would cause the blood to become too acidic" }
      ],
      "answerId": "b",
      "explanation": "Insulin cannot be taken orally because its proteins would be destroyed during the digestive process."
    },
    {
      "id": "q80",
      "type": "mcq",
      "prompt": "Rapid-acting insulins (bolus insulins) begin working how long after injection?",
      "slideRef": { "slideNumber": 55, "slideTitle": "Insulin Replacement", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "5–30 minutes" },
        { "id": "b", "text": "2–4 hours" },
        { "id": "c", "text": "12–24 hours" },
        { "id": "d", "text": "30–60 minutes" }
      ],
      "answerId": "a",
      "explanation": "Rapid-acting (bolus) insulins begin working 5–30 minutes after injection."
    },
    {
      "id": "q81",
      "type": "mcq",
      "prompt": "Basal (long-acting) insulins remain in the bloodstream for up to how long?",
      "slideRef": { "slideNumber": 55, "slideTitle": "Insulin Replacement", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "1–2 hours" },
        { "id": "b", "text": "5–30 minutes" },
        { "id": "c", "text": "12–24 hours" },
        { "id": "d", "text": "3–5 days" }
      ],
      "answerId": "c",
      "explanation": "Basal insulins begin working 2–4 hours after injection and remain in the bloodstream for up to 12–24 hours."
    },
    {
      "id": "q82",
      "type": "mcq",
      "prompt": "Which of the following is an example of a rapid-acting (bolus) insulin listed in the slides?",
      "slideRef": { "slideNumber": 55, "slideTitle": "Insulin Replacement", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Metformin" },
        { "id": "b", "text": "NovoLog" },
        { "id": "c", "text": "Glipizide" },
        { "id": "d", "text": "Acarbose" }
      ],
      "answerId": "b",
      "explanation": "NovoLog (along with Apidra and Humalog) are listed as rapid-acting (bolus) insulins."
    },
    {
      "id": "q83",
      "type": "mcq",
      "prompt": "An insulin pump is programmed to deliver which two types of insulin doses?",
      "slideRef": { "slideNumber": 60, "slideTitle": "Insulin Pump", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Oral and injectable doses" },
        { "id": "b", "text": "Continuous customized basal doses and user-directed bolus doses" },
        { "id": "c", "text": "Weekly long-acting doses and daily short-acting doses" },
        { "id": "d", "text": "Intravenous doses and subcutaneous doses" }
      ],
      "answerId": "b",
      "explanation": "Insulin pumps deliver continuous customized basal doses and user-directed bolus doses to cover meals or correct hyperglycemia."
    },
    {
      "id": "q84",
      "type": "mcq",
      "prompt": "Type 2 diabetes management is initially approached with:",
      "slideRef": { "slideNumber": 61, "slideTitle": "Medical Management for Type 2 Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Insulin injections and CGM devices" },
        { "id": "b", "text": "Nutritional strategies and regular exercise incorporated into daily routines" },
        { "id": "c", "text": "Dialysis and kidney transplant" },
        { "id": "d", "text": "Immediate pharmacological intervention with metformin" }
      ],
      "answerId": "b",
      "explanation": "Type 2 diabetes is initially managed with the incorporation of nutritional strategies and regular exercise into daily routines."
    },
    {
      "id": "q85",
      "type": "mcq",
      "prompt": "Foods high in simple sugars have a higher glycemic index and affect blood glucose in which way?",
      "slideRef": { "slideNumber": 61, "slideTitle": "Medical Management for Type 2 Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "More slowly and less significantly" },
        { "id": "b", "text": "More significantly and more quickly" },
        { "id": "c", "text": "Only after a delay of 2–3 hours" },
        { "id": "d", "text": "They do not affect blood glucose" }
      ],
      "answerId": "b",
      "explanation": "Foods high in simple sugars have a higher glycemic index and affect blood glucose more significantly and more quickly."
    },
    {
      "id": "q86",
      "type": "mcq",
      "prompt": "The recommended minimum amount of moderate-intense aerobic activity per day for children or adolescents with Type 2 diabetes is:",
      "slideRef": { "slideNumber": 63, "slideTitle": "Lifestyle Changes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "30 minutes" },
        { "id": "b", "text": "45 minutes" },
        { "id": "c", "text": "60 minutes" },
        { "id": "d", "text": "90 minutes" }
      ],
      "answerId": "c",
      "explanation": "Children or adolescents with Type 2 diabetes should engage in a minimum of 60 minutes of moderate-intense aerobic activity per day."
    },
    {
      "id": "q87",
      "type": "mcq",
      "prompt": "The recommended amount of moderate-vigorous aerobic activity per week for adults with diabetes is:",
      "slideRef": { "slideNumber": 63, "slideTitle": "Lifestyle Changes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "60 minutes or more" },
        { "id": "b", "text": "100 minutes or more" },
        { "id": "c", "text": "150 minutes or more" },
        { "id": "d", "text": "300 minutes or more" }
      ],
      "answerId": "c",
      "explanation": "Adults with diabetes are recommended to engage in 150 minutes or more of moderate-vigorous aerobic activity per week."
    },
    {
      "id": "q88",
      "type": "mcq",
      "prompt": "Resistive strengthening exercise is recommended how many sessions per week for adults with diabetes?",
      "slideRef": { "slideNumber": 63, "slideTitle": "Lifestyle Changes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "1 session per week" },
        { "id": "b", "text": "2–3 sessions per week" },
        { "id": "c", "text": "5–6 sessions per week" },
        { "id": "d", "text": "Daily" }
      ],
      "answerId": "b",
      "explanation": "Adults with diabetes are recommended to engage in 2–3 sessions of resistive strengthening exercise per week."
    },
    {
      "id": "q89",
      "type": "mcq",
      "prompt": "Older adults with diabetes are specifically recommended to also engage in flexibility and balance training how often?",
      "slideRef": { "slideNumber": 63, "slideTitle": "Lifestyle Changes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Daily" },
        { "id": "b", "text": "Once per week" },
        { "id": "c", "text": "2–3 times per week" },
        { "id": "d", "text": "Once per month" }
      ],
      "answerId": "c",
      "explanation": "Older adults with diabetes should also engage in flexibility and balance training 2–3 times per week."
    },
    {
      "id": "q90",
      "type": "mcq",
      "prompt": "Modest and sustained weight loss in Type 2 diabetes has been shown to improve which two factors?",
      "slideRef": { "slideNumber": 65, "slideTitle": "Lifestyle Changes – Weight Control", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Retinopathy and nephropathy" },
        { "id": "b", "text": "Insulin sensitivity and beta-cell function" },
        { "id": "c", "text": "Peripheral neuropathy and autonomic neuropathy" },
        { "id": "d", "text": "Ketone production and liver function" }
      ],
      "answerId": "b",
      "explanation": "Modest and sustained weight loss has been shown to improve insulin sensitivity and beta-cell function, yielding improved blood glucose control."
    },
    {
      "id": "q91",
      "type": "mcq",
      "prompt": "Metformin works primarily by:",
      "slideRef": { "slideNumber": 67, "slideTitle": "Pharmacological Management", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Increasing insulin production in the pancreas" },
        { "id": "b", "text": "Decreasing the release of glucose from the liver" },
        { "id": "c", "text": "Delaying the absorption of carbohydrates" },
        { "id": "d", "text": "Replacing insulin completely" }
      ],
      "answerId": "b",
      "explanation": "Metformin decreases the release of glucose from the liver and has a relatively low incidence of side effects."
    },
    {
      "id": "q92",
      "type": "mcq",
      "prompt": "Which of the following is listed as an oral glucose-lowering medication mechanism?",
      "slideRef": { "slideNumber": 67, "slideTitle": "Pharmacological Management", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Destroying residual beta cells" },
        { "id": "b", "text": "Increasing insulin resistance" },
        { "id": "c", "text": "Delaying breakdown of sugar" },
        { "id": "d", "text": "Stimulating ketone production" }
      ],
      "answerId": "c",
      "explanation": "Oral glucose-lowering medications work by mechanisms including decreasing liver glucose release, increasing insulin production, improving insulin sensitivity, and delaying breakdown of sugar."
    },
    {
      "id": "q93",
      "type": "mcq",
      "prompt": "Which aspect of occupational therapy for diabetes is described as critical for preventing further complications and supporting overall health?",
      "slideRef": { "slideNumber": 70, "slideTitle": "Occupational Implications Cont.", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Insulin administration training" },
        { "id": "b", "text": "Self-management education" },
        { "id": "c", "text": "Surgical wound care" },
        { "id": "d", "text": "Dialysis management" }
      ],
      "answerId": "b",
      "explanation": "Self-management education is critical for implementing and sustaining performance patterns that prevent further complications and support overall health."
    },
    {
      "id": "q94",
      "type": "mcq",
      "prompt": "Under occupational implications, which IADL is specifically listed for diabetes management?",
      "slideRef": { "slideNumber": 71, "slideTitle": "Occupational Implications Cont. 2", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Driving" },
        { "id": "b", "text": "Shopping for groceries and preparing healthy meals" },
        { "id": "c", "text": "Financial management" },
        { "id": "d", "text": "Child rearing" }
      ],
      "answerId": "b",
      "explanation": "Under IADLs, shopping for groceries and preparing healthy meals is specifically listed for diabetes management."
    },
    {
      "id": "q95",
      "type": "mcq",
      "prompt": "Poor sleep in diabetes management can affect which two outcomes?",
      "slideRef": { "slideNumber": 71, "slideTitle": "Occupational Implications Cont. 2", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Insulin sensitivity and ketone production" },
        { "id": "b", "text": "Glycemic control and performance of daily occupations" },
        { "id": "c", "text": "Blood pressure and cholesterol levels" },
        { "id": "d", "text": "Nephropathy and retinopathy progression" }
      ],
      "answerId": "b",
      "explanation": "Poor sleep can affect glycemic control and performance of daily occupations."
    },
    {
      "id": "q96",
      "type": "mcq",
      "prompt": "Skin care is listed under which occupational category in the diabetes occupational implications slide?",
      "slideRef": { "slideNumber": 71, "slideTitle": "Occupational Implications Cont. 2", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "IADLs" },
        { "id": "b", "text": "Rest and Sleep" },
        { "id": "c", "text": "ADLs" },
        { "id": "d", "text": "Health Management" }
      ],
      "answerId": "c",
      "explanation": "Skin care is listed under ADLs (Activities of Daily Living) in the occupational implications section."
    },
    {
      "id": "q97",
      "type": "mcq",
      "prompt": "Which of the following best summarizes the overall occupational therapy role in diabetes management as described in the summary slide?",
      "slideRef": { "slideNumber": 72, "slideTitle": "Summary", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Prescribing insulin and monitoring A1C levels" },
        { "id": "b", "text": "Supporting health management routines, self-management education, safety, and sustained participation in daily occupations across the lifespan" },
        { "id": "c", "text": "Performing dialysis treatment and kidney transplant coordination" },
        { "id": "d", "text": "Diagnosing diabetes and managing pharmacological regimens" }
      ],
      "answerId": "b",
      "explanation": "The summary states that occupational therapy supports health management routines, self-management education, safety, and sustained participation in daily occupations across the lifespan."
    },
    {
      "id": "q98",
      "type": "mcq",
      "prompt": "According to the summary, which type of diabetes results from autoimmune destruction of pancreatic beta cells?",
      "slideRef": { "slideNumber": 72, "slideTitle": "Summary", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Type 2 diabetes" },
        { "id": "b", "text": "Gestational diabetes" },
        { "id": "c", "text": "Type 1 diabetes" },
        { "id": "d", "text": "MODY" }
      ],
      "answerId": "c",
      "explanation": "The summary states: Type 1 results from autoimmune destruction of pancreatic beta cells and requires lifelong insulin replacement."
    },
    {
      "id": "q99",
      "type": "mcq",
      "prompt": "Which of the following hyperglycemia symptoms involves increased frequency of urination (polyuria)?",
      "slideRef": { "slideNumber": 28, "slideTitle": "Hyperglycemia vs Hypoglycemia", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Polyphagia" },
        { "id": "b", "text": "Polydipsia" },
        { "id": "c", "text": "Polyuria" },
        { "id": "d", "text": "Pallor" }
      ],
      "answerId": "c",
      "explanation": "Polyuria means more/frequent urination, which is a hyperglycemia symptom. The slide uses the mnemonic 'POLY means more.'"
    },
    {
      "id": "q100",
      "type": "mcq",
      "prompt": "For hypoglycemia, the mnemonic from the comparison slide uses the word TIRED. What does 'E' stand for?",
      "slideRef": { "slideNumber": 28, "slideTitle": "Hyperglycemia vs Hypoglycemia", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Edema" },
        { "id": "b", "text": "Excessive hunger" },
        { "id": "c", "text": "Elevated glucose" },
        { "id": "d", "text": "Exercise intolerance" }
      ],
      "answerId": "b",
      "explanation": "In the TIRED mnemonic for hypoglycemia: T=Tachycardia, I=Irritability, R=Restless, E=Excessive Hunger, D=Dizziness."
    },
    {
      "id": "q101",
      "type": "match",
      "prompt": "Match each diabetes type with its primary treatment approach as described in the slides.",
      "slideRef": { "slideNumber": 11, "slideTitle": "Type 1 vs Type 2 Cont.", "fileName": "Diabetes.pdf" },
      "pairs": [
        { "left": "Type 1 Diabetes", "right": "Treated with insulin injections" },
        { "left": "Type 2 Diabetes", "right": "Managed with drugs and lifestyle changes" }
      ],
      "explanation": "Type 1 requires insulin injection as the primary treatment; Type 2 is managed with medications and lifestyle modifications."
    },
    {
      "id": "q102",
      "type": "mcq",
      "prompt": "Which of the following is a non-modifiable risk factor for Type 2 diabetes listed in the slides?",
      "slideRef": { "slideNumber": 3, "slideTitle": "Types of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Unhealthy diet" },
        { "id": "b", "text": "Obesity" },
        { "id": "c", "text": "Lack of physical exercise" },
        { "id": "d", "text": "Family history" }
      ],
      "answerId": "d",
      "explanation": "Non-modifiable risk factors listed in the slide include age, ethnicity, and family history. Unhealthy diet, obesity, and lack of physical exercise are modifiable risk factors."
    },
    {
      "id": "q103",
      "type": "mcq",
      "prompt": "Monogenic diabetes is related to a change or defect in:",
      "slideRef": { "slideNumber": 14, "slideTitle": "Other Specific Types of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Multiple genes simultaneously" },
        { "id": "b", "text": "A single gene" },
        { "id": "c", "text": "An autoimmune response" },
        { "id": "d", "text": "Hormonal changes during pregnancy" }
      ],
      "answerId": "b",
      "explanation": "Monogenic diabetes are related to a change or defect in a single gene and include NDM and MODY."
    },
    {
      "id": "q104",
      "type": "mcq",
      "prompt": "NDM occurs in infants during which age range?",
      "slideRef": { "slideNumber": 14, "slideTitle": "Other Specific Types of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "Birth to 3 months" },
        { "id": "b", "text": "First 6–12 months of life" },
        { "id": "c", "text": "1–5 years of age" },
        { "id": "d", "text": "Under 18 years of age" }
      ],
      "answerId": "b",
      "explanation": "NDM occurs in the first 6–12 months of life."
    },
    {
      "id": "q105",
      "type": "mcq",
      "prompt": "Which of the following is listed as an 'other specific type' of diabetes related to diseases of the exocrine pancreas?",
      "slideRef": { "slideNumber": 14, "slideTitle": "Other Specific Types of Diabetes", "fileName": "Diabetes.pdf" },
      "options": [
        { "id": "a", "text": "MODY" },
        { "id": "b", "text": "Gestational diabetes" },
        { "id": "c", "text": "Cystic fibrosis-related diabetes (CFRD)" },
        { "id": "d", "text": "Type 3 diabetes" }
      ],
      "answerId": "c",
      "explanation": "Other specific types of diabetes include diseases of the exocrine pancreas such as cystic fibrosis-related diabetes (CFRD) and pancreatitis."
    }
  ]
};

function safeJsonParse<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as T;
    return { ok: true, value: parsed };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Invalid JSON" };
  }
}

function assertConfigShape(config: any): { ok: true; value: AppConfig } | { ok: false; error: string } {
  if (!config || typeof config !== "object") return { ok: false, error: "Config must be an object." };
  if (typeof config.title !== "string") return { ok: false, error: "Config.title must be a string." };
  if (!Array.isArray(config.questions)) return { ok: false, error: "Config.questions must be an array." };
  

  const ids = new Set<string>();
  for (const q of config.questions) {
    if (!q || typeof q !== "object") return { ok: false, error: "Each question must be an object." };
    if (typeof q.id !== "string" || !q.id.trim()) return { ok: false, error: "Each question must have a non-empty string id." };
    if (ids.has(q.id)) return { ok: false, error: `Duplicate question id: ${q.id}` };
    ids.add(q.id);

    if (typeof q.prompt !== "string" || !q.prompt.trim()) return { ok: false, error: `Question ${q.id} must have a non-empty prompt.` };
    if (q.type !== "mcq" && q.type !== "match") return { ok: false, error: `Question ${q.id} has invalid type. Use "mcq" or "match".` };

    if (q.slideRef !== undefined) {
      if (typeof q.slideRef !== "object" || q.slideRef === null) {
        return { ok: false, error: `Question ${q.id} slideRef must be an object.` };
      }
    
      if (typeof q.slideRef.slideNumber !== "number") {
        return { ok: false, error: `Question ${q.id} slideRef.slideNumber must be a number.` };
      }
    
      if (q.slideRef.slideTitle !== undefined && typeof q.slideRef.slideTitle !== "string") {
        return { ok: false, error: `Question ${q.id} slideRef.slideTitle must be a string if provided.` };
      }
    
      if (q.slideRef.section !== undefined && typeof q.slideRef.section !== "string") {
        return { ok: false, error: `Question ${q.id} slideRef.section must be a string if provided.` };
      }
    
      if (q.slideRef.fileName !== undefined && typeof q.slideRef.fileName !== "string") {
        return { ok: false, error: `Question ${q.id} slideRef.fileName must be a string if provided.` };
      }
    }

    if (q.type === "mcq") {
      if (!Array.isArray(q.options) || q.options.length < 2) return { ok: false, error: `MCQ ${q.id} must have at least 2 options.` };
      const optIds = new Set<string>();
      for (const o of q.options) {
        if (!o || typeof o !== "object") return { ok: false, error: `MCQ ${q.id} options must be objects.` };
        if (typeof o.id !== "string" || !o.id.trim()) return { ok: false, error: `MCQ ${q.id} option id must be a string.` };
        if (optIds.has(o.id)) return { ok: false, error: `MCQ ${q.id} has duplicate option id: ${o.id}` };
        optIds.add(o.id);
        if (typeof o.text !== "string") return { ok: false, error: `MCQ ${q.id} option ${o.id} must have text.` };
      }
      if (typeof q.answerId !== "string" || !optIds.has(q.answerId)) {
        return { ok: false, error: `MCQ ${q.id} answerId must match one of the option ids.` };
      }
    }

    if (q.type === "match") {
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) return { ok: false, error: `Match ${q.id} must have at least 2 pairs.` };
      for (const p of q.pairs) {
        if (!p || typeof p !== "object") return { ok: false, error: `Match ${q.id} pairs must be objects.` };
        if (typeof p.left !== "string" || typeof p.right !== "string") return { ok: false, error: `Match ${q.id} pairs must have left and right strings.` };
      }
    }
  }

  return { ok: true, value: config as AppConfig };
}

function shuffleArray<T>(arr: T[], seed?: number): T[] {
  const a = [...arr];
  let s = typeof seed === "number" ? seed : Date.now();
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDefaultSession(config: AppConfig): SessionState {
  const order = config.questions.map((q) => q.id);
  return {
    config,
    settings: { shuffle: true, showExplanations: true, autoAdvance: true },
    progress: {
      currentIndex: 0,
      order,
      answersById: {},
      retryVersionById: {},
      startedAt: Date.now(),
    },
  };
}

function loadSession(): SessionState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return buildDefaultSession(sampleConfig);

  const parsed = safeJsonParse<SessionState>(raw);
  if (!parsed.ok) return buildDefaultSession(sampleConfig);

  const cfgCheck = assertConfigShape(parsed.value.config);
  if (!cfgCheck.ok) return buildDefaultSession(sampleConfig);

  const cfg = cfgCheck.value;
  const order = Array.isArray(parsed.value.progress?.order) ? parsed.value.progress.order : cfg.questions.map((q) => q.id);
  const cleanOrder = order.filter((id) => cfg.questions.some((q) => q.id === id));
  const missing = cfg.questions.map((q) => q.id).filter((id) => !cleanOrder.includes(id));
  const finalOrder = [...cleanOrder, ...missing];

  return {
    config: cfg,
    settings: {
      shuffle: !!parsed.value.settings?.shuffle,
      showExplanations: parsed.value.settings?.showExplanations ?? true,
      autoAdvance: parsed.value.settings?.autoAdvance ?? true,
    },
    progress: {
      currentIndex: Math.min(Math.max(parsed.value.progress?.currentIndex ?? 0, 0), Math.max(finalOrder.length - 1, 0)),
      order: finalOrder,
      answersById: parsed.value.progress?.answersById ?? {},
      retryVersionById: parsed.value.progress?.retryVersionById ?? {},
      startedAt: parsed.value.progress?.startedAt ?? Date.now(),
      completedAt: parsed.value.progress?.completedAt,
    },
  };
}

function saveSession(session: SessionState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function percent(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}

function nowMs() {
  return Date.now();
}

export default function App() {
  const [session, setSession] = useState<SessionState>(() => loadSession());
  const [tab, setTab] = useState<"quiz" | "review" | "settings">("quiz");

  const [settingsDraft, setSettingsDraft] = useState<string>(() => JSON.stringify(session.config, null, 2));
  const [settingsError, setSettingsError] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const questionsById = useMemo(() => {
    const m = new Map<string, Question>();
    for (const q of session.config.questions) m.set(q.id, q);
    return m;
  }, [session.config.questions]);

  const orderedQuestions = useMemo(() => {
    return session.progress.order.map((id) => questionsById.get(id)).filter(Boolean) as Question[];
  }, [session.progress.order, questionsById]);

  const total = orderedQuestions.length;
  const current = orderedQuestions[session.progress.currentIndex];

  const answeredCount = useMemo(() => Object.keys(session.progress.answersById).length, [session.progress.answersById]);

  const correctCount = useMemo(() => {
    return Object.values(session.progress.answersById).filter((a) => a.isCorrect).length;
  }, [session.progress.answersById]);

  const incorrectIds = useMemo(() => {
    return Object.values(session.progress.answersById).filter((a) => !a.isCorrect).map((a) => a.questionId);
  }, [session.progress.answersById]);

  const completionPct = percent(answeredCount, total);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1600);
  }

  function startNewSessionShuffleMaybe() {
    setSession((prev) => {
      const baseOrder = prev.config.questions.map((q) => q.id);
      const order = prev.settings.shuffle ? shuffleArray(baseOrder) : baseOrder;
      return {
        ...prev,
        progress: {
          currentIndex: 0,
          order,
          answersById: {},
          retryVersionById: {},
          startedAt: nowMs(),
          completedAt: undefined,
        },
      };
    });
  }

  function resetAnswersKeepOrder() {
    setSession((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        currentIndex: 0,
        answersById: {},
        retryVersionById: {},
        startedAt: nowMs(),
        completedAt: undefined,
      },
    }));
    showToast("Answers reset");
    setTab("quiz");
  }

  function jumpTo(index: number) {
    setSession((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        currentIndex: Math.min(Math.max(index, 0), Math.max(prev.progress.order.length - 1, 0)),
      },
    }));
  }

  function goPrev() {
    setSession((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        currentIndex: Math.max(0, prev.progress.currentIndex - 1),
      },
    }));
  }

  // Keeps asking missed questions until they are correct.
  // Once a question is correct, it drops out of the loop automatically.
  function goNext() {
    setSession((prev) => {
      const totalLocal = prev.progress.order.length;
      if (totalLocal === 0) return prev;
  
      const isCorrectById = new Map<string, boolean>();
      for (const [qid, att] of Object.entries(prev.progress.answersById)) {
        isCorrectById.set(qid, !!att.isCorrect);
      }
  
      const allCorrect = prev.progress.order.every((id) => isCorrectById.get(id) === true);
      if (allCorrect) {
        return {
          ...prev,
          progress: { ...prev.progress, completedAt: prev.progress.completedAt ?? Date.now() },
        };
      }
  
      // Find next question that is NOT correct (unanswered or incorrect), wrap around
      let nextIndex = prev.progress.currentIndex;
      for (let step = 1; step <= totalLocal; step++) {
        const idx = (prev.progress.currentIndex + step) % totalLocal;
        const qid = prev.progress.order[idx];
        const ok = isCorrectById.get(qid) === true;
        if (!ok) {
          nextIndex = idx;
          break;
        }
      }
  
      const nextQid = prev.progress.order[nextIndex];
      const nextAttempt = prev.progress.answersById[nextQid];
  
      // If we are revisiting because it was incorrect, clear the attempt so it looks fresh
      let answersById = prev.progress.answersById;
      let retryVersionById = prev.progress.retryVersionById ?? {};

      if (nextAttempt && nextAttempt.isCorrect === false) {
        const copy = { ...prev.progress.answersById };
        delete copy[nextQid];
        answersById = copy;

        const rv = { ...retryVersionById };
        rv[nextQid] = (rv[nextQid] ?? 0) + 1;
        retryVersionById = rv;
      }

      return {
        ...prev,
        progress: {
          ...prev.progress,
          currentIndex: nextIndex,
          answersById,
          retryVersionById,
        },
      };
    });
  }
  function markMcq(question: McqQuestion, chosen: string) {
    const isCorrect = chosen === question.answerId;
    const attempt: Attempt = {
      questionId: question.id,
      type: "mcq",
      isCorrect,
      chosenAnswerId: chosen,
      timestamp: nowMs(),
    };
    setSession((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        answersById: { ...prev.progress.answersById, [question.id]: attempt },
      },
    }));

  }

  function markMatch(question: MatchQuestion, chosenPairs: Array<{ left: string; right: string }>) {
    const correctPairs = question.pairs;
    const normalize = (pairs: Array<{ left: string; right: string }>) =>
      [...pairs].map((p) => `${p.left}=>${p.right}`).sort().join("|");
    const isCorrect = normalize(chosenPairs) === normalize(correctPairs);

    const attempt: Attempt = {
      questionId: question.id,
      type: "match",
      isCorrect,
      chosenPairs,
      timestamp: nowMs(),
    };

    setSession((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        answersById: { ...prev.progress.answersById, [question.id]: attempt },
      },
    }));

  }

  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Copied"))
      .catch(() => showToast("Copy failed"));
  }

  function applySettingsJson() {
    setSettingsError("");
    const parsed = safeJsonParse<any>(settingsDraft);
    if (!parsed.ok) {
      setSettingsError(parsed.error);
      return;
    }
    const checked = assertConfigShape(parsed.value);
    if (!checked.ok) {
      setSettingsError(checked.error);
      return;
    }

    const cfg = checked.value;

    setSession((prev) => {
      const baseOrder = cfg.questions.map((q) => q.id);
      const order = prev.settings.shuffle ? shuffleArray(baseOrder) : baseOrder;
      return {
        ...prev,
        config: cfg,
        progress: {
          currentIndex: 0,
          order,
          answersById: {},
          startedAt: nowMs(),
          retryVersionById: {},
          completedAt: undefined,
        },
      };
    });

    showToast("Config applied");
    setTab("quiz");
  }

  useEffect(() => {
    setSettingsDraft(JSON.stringify(session.config, null, 2));
  }, [session.config]);

  const header = (
    <div className="topbar">
      <div className="topbar-left">
        <div className="title">{session.config.title}</div>
        {session.config.instructions ? <div className="subtitle">{session.config.instructions}</div> : null}
      </div>

      <div className="topbar-right">
        <button className={`tab ${tab === "quiz" ? "active" : ""}`} onClick={() => setTab("quiz")}>
          Quiz
        </button>
        <button className={`tab ${tab === "review" ? "active" : ""}`} onClick={() => setTab("review")}>
          Review
        </button>
        <button className={`tab ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
          Settings
        </button>
      </div>
    </div>
  );

  const progressBar = (
    <div className="progress-wrap">
      <div className="progress-meta">
        <div>
          Progress: <b>{answeredCount}</b>/{total} ({completionPct}%)
        </div>
        <div>
          Score: <b>{correctCount}</b> correct, <b>{answeredCount - correctCount}</b> incorrect
        </div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${completionPct}%` }} />
      </div>
    </div>
  );

  const footerActions = (
    <div className="footer">
      <div className="footer-left">
        <label className="toggle">
          <input
            type="checkbox"
            checked={session.settings.shuffle}
            onChange={(e) => {
              const v = e.target.checked;
              setSession((prev) => ({ ...prev, settings: { ...prev.settings, shuffle: v } }));
            }}
          />
          Shuffle on new session
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={session.settings.showExplanations}
            onChange={(e) => {
              const v = e.target.checked;
              setSession((prev) => ({ ...prev, settings: { ...prev.settings, showExplanations: v } }));
            }}
          />
          Show explanations
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={session.settings.autoAdvance}
            onChange={(e) => {
              const v = e.target.checked;
              setSession((prev) => ({ ...prev, settings: { ...prev.settings, autoAdvance: v } }));
            }}
          />
          Auto advance
        </label>
      </div>

      <div className="footer-right">
        <button className="btn ghost" onClick={() => startNewSessionShuffleMaybe()}>
          New session
        </button>
        <button className="btn ghost" onClick={() => resetAnswersKeepOrder()}>
          Reset answers
        </button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {header}
      {toast ? <div className="toast">{toast}</div> : null}

      {tab === "quiz" ? (
        <div className="panel">
          {progressBar}

          {!current ? (
            <div className="card">
              <h2>No questions found</h2>
              <p>Go to Settings and paste your JSON.</p>
            </div>
          ) : (
            <QuizCard
              key={current.id}
              index={session.progress.currentIndex}
              total={total}
              question={current}
              attempt={session.progress.answersById[current.id]}
              retryVersion={session.progress.retryVersionById?.[current.id] ?? 0}
              onPrev={goPrev}
              onNext={goNext}
              onJump={jumpTo}
              onAnswerMcq={markMcq}
              onAnswerMatch={markMatch}
              showExplanation={session.settings.showExplanations}
              allAttempts={session.progress.answersById}
              orderedQuestions={orderedQuestions}
            />
          )}

          {footerActions}
        </div>
      ) : null}

      {tab === "review" ? (
        <div className="panel">
          {progressBar}

          <div className="card">
            <h2>Review incorrect</h2>
            <p>
              You have <b>{incorrectIds.length}</b> incorrect question(s).
            </p>
            {incorrectIds.length === 0 ? (
              <div className="muted">Nothing to review yet.</div>
            ) : (
              <div className="review-list">
                {incorrectIds.map((id) => {
                  const q = questionsById.get(id);
                  if (!q) return null;
                  const idx = session.progress.order.indexOf(id);
                  return (
                    <button
                      key={id}
                      className="review-item"
                      onClick={() => {
                        setTab("quiz");
                        jumpTo(idx);
                      }}
                    >
                      <div className="review-type">{q.type.toUpperCase()}</div>
                      <div className="review-prompt">{q.prompt}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {footerActions}
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="panel">
          <div className="card">
            <h2>Paste JSON config</h2>
            <p className="muted">
              Paste an AppConfig object. It must include: title, questions. Each question must have id, type, prompt, and the
              required fields per type.
            </p>

            <div className="settings-actions">
              <button className="btn ghost" onClick={() => setSettingsDraft(JSON.stringify(sampleConfig, null, 2))}>
                Load demo
              </button>
              <button className="btn ghost" onClick={() => copyToClipboard(settingsDraft)}>
                Copy current JSON
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  setSession(buildDefaultSession(sampleConfig));
                  showToast("Local storage cleared");
                }}
              >
                Clear storage
              </button>
            </div>

            <textarea className="textarea" value={settingsDraft} onChange={(e) => setSettingsDraft(e.target.value)} spellCheck={false} />

            {settingsError ? <div className="error">{settingsError}</div> : null}

            <div className="settings-actions">
              <button className="btn" onClick={applySettingsJson}>
                Apply
              </button>
            </div>

            <div className="card subtle">
              <h3>Schema reminder</h3>
              <pre className="code">
              <pre className="code">
              {`{
  "title": "My Quiz",
  "instructions": "Optional",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "Question text",
      "slideRef": {
        "slideNumber": 12,
        "slideTitle": "Optional slide title",
        "section": "Optional section",
        "fileName": "Optional file name"
      },
      "options": [
        { "id": "a", "text": "Option A" },
        { "id": "b", "text": "Option B" },
        { "id": "c", "text": "Option C" },
        { "id": "d", "text": "Option D" }
      ],
      "answerId": "b",
      "explanation": "Optional explanation"
    },
    {
      "id": "q2",
      "type": "match",
      "prompt": "Match the items",
      "slideRef": {
        "slideNumber": 27,
        "slideTitle": "Optional slide title",
        "section": "Optional section",
        "fileName": "Optional file name"
      },
      "pairs": [
        { "left": "Term 1", "right": "Definition 1" },
        { "left": "Term 2", "right": "Definition 2" }
      ],
      "explanation": "Optional explanation"
    }
  ]
}`}
</pre>
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuizCard(props: {
  index: number;
  total: number;
  question: Question;
  attempt?: Attempt;
  retryVersion: number;
  onPrev: () => void;
  onNext: () => void;
  onJump: (i: number) => void;
  onAnswerMcq: (q: McqQuestion, chosen: string) => void;
  onAnswerMatch: (q: MatchQuestion, chosenPairs: Array<{ left: string; right: string }>) => void;
  showExplanation: boolean;
  allAttempts: Record<string, Attempt>;
  orderedQuestions: Question[];
}) {
  const { index, total, question, attempt, retryVersion, onPrev, onNext, onJump, onAnswerMcq, onAnswerMatch, showExplanation, allAttempts, orderedQuestions } = props;

  return (
    <div className="card">
      <div className="card-header">
        <div className="pill">
          Question <b>{index + 1}</b> of <b>{total}</b>
        </div>

        <div className="jump">
          <label className="muted">Jump</label>
          <select value={index} onChange={(e) => onJump(Number(e.target.value))}>
            {orderedQuestions.map((q, i) => {
              const a = allAttempts[q.id];
              const status = !a ? " " : a.isCorrect ? "✓" : "✗";
              return (
                <option key={q.id} value={i}>
                  {i + 1}. {q.type.toUpperCase()} {status}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <h2 className="prompt">{question.prompt}</h2>
      {question.slideRef && (
  <div className="slide-ref">
    📘 Slide {question.slideRef.slideNumber}
    {question.slideRef.slideTitle ? ` - ${question.slideRef.slideTitle}` : ""}
    {question.slideRef.section ? ` | ${question.slideRef.section}` : ""}
  </div>
)}

      {question.type === "mcq" ? (
        <McqView question={question} attempt={attempt} retryVersion={retryVersion} onChoose={(id) => onAnswerMcq(question, id)} />
      ) : (
        <MatchView question={question} attempt={attempt} onSubmit={(pairs) => onAnswerMatch(question, pairs)} />
      )}

      {attempt ? <div className={`result ${attempt.isCorrect ? "good" : "bad"}`}>{attempt.isCorrect ? "Correct" : "Incorrect"}</div> : null}

      {attempt && showExplanation && question.explanation ? (
        <div className="explain">
          <div className="explain-title">Explanation</div>
          <div className="explain-body">{question.explanation}</div>
        </div>
      ) : null}

      <div className="nav">
        <button className="btn ghost" onClick={onPrev} disabled={index === 0}>
          Previous
        </button>
        <button className="btn ghost" onClick={onNext} disabled={total === 0}>
          Next
        </button>
      </div>
    </div>
  );
}

function McqView(props: {
  question: McqQuestion;
  attempt?: Attempt;
  retryVersion: number;
  onChoose: (id: string) => void;
}) {
  const { question, attempt, retryVersion, onChoose } = props;
  const shuffledOptions = useMemo(() => {
    // If already answered correctly, keep original order
    if (attempt?.isCorrect) return question.options;
  
    // Otherwise shuffle based on retry version
    return shuffleArray(question.options, retryVersion + 1);
  }, [question.options, attempt, retryVersion]);

  return (
    <div className="choices">
      {shuffledOptions.map((o) => {
        const chosen = attempt?.chosenAnswerId === o.id;
        const correct = o.id === question.answerId;
        const showMark = !!attempt;

        const cls = ["choice", chosen ? "chosen" : "", showMark && correct ? "correct" : "", showMark && chosen && !correct ? "wrong" : ""]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={o.id}
            className={cls}
            onClick={() => onChoose(o.id)}
            disabled={attempt?.isCorrect === true}
>
            <div className="choice-left">
              <div className="choice-id">{o.id.toUpperCase()}</div>
              <div className="choice-text">{o.text}</div>
            </div>
            {showMark ? <div className="choice-mark">{correct ? "✓" : chosen ? "✗" : ""}</div> : null}
          </button>
        );
      })}
    </div>
  );
}

function MatchView(props: {
  question: MatchQuestion;
  attempt?: Attempt;
  onSubmit: (pairs: Array<{ left: string; right: string }>) => void;
}) {
  const { question, attempt, onSubmit } = props;

  const leftItems = useMemo(() => question.pairs.map((p) => p.left), [question.pairs]);
  const rightItemsShuffled = useMemo(() => shuffleArray(question.pairs.map((p) => p.right)), [question.pairs]);

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const l of leftItems) init[l] = "";
    return init;
  });

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const l of leftItems) init[l] = "";
    setSelected(init);
  }, [question.id, leftItems]);

  const locked = attempt?.isCorrect === true;

  const chosenPairs = useMemo(() => {
    return leftItems.map((l) => ({ left: l, right: selected[l] })).filter((p) => p.right);
  }, [leftItems, selected]);

  const canSubmit = chosenPairs.length === leftItems.length && !locked;

  const correctMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of question.pairs) m.set(p.left, p.right);
    return m;
  }, [question.pairs]);

  function submit() {
    if (!canSubmit) return;
    onSubmit(chosenPairs);
  }

  return (
    <div className="match">
      <div className="match-grid">
        {leftItems.map((l) => {
          const chosenRight = locked ? attempt?.chosenPairs?.find((p) => p.left === l)?.right ?? "" : selected[l];
          const correctRight = correctMap.get(l) ?? "";
          const isCorrect = locked ? chosenRight === correctRight : false;

          return (
            <div key={l} className="match-row">
              <div className="match-left">{l}</div>
              <select
                className={`match-select ${locked ? (isCorrect ? "ok" : "no") : ""}`}
                value={chosenRight}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelected((prev) => ({ ...prev, [l]: v }));
                }}
                disabled={locked}
              >
                <option value="">Select</option>
                {rightItemsShuffled.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {locked ? <div className="match-mark">{isCorrect ? "✓" : "✗"}</div> : <div className="match-mark" />}
            </div>
          );
        })}
      </div>

      <div className="match-actions">
        <button className="btn" onClick={submit} disabled={!canSubmit}>
          Submit matches
        </button>
        {!locked ? <div className="muted">Tip: you must match all items before submitting.</div> : null}
      </div>

      {locked ? (
        <div className="match-correct">
          <div className="explain-title">Correct pairs</div>
          <ul className="pairs">
            {question.pairs.map((p) => (
              <li key={`${p.left}=>${p.right}`}>
                <b>{p.left}</b> , {p.right}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
