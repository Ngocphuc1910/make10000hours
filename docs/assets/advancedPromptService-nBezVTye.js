var E=Object.defineProperty;var v=(d,e,t)=>e in d?E(d,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):d[e]=t;var g=(d,e,t)=>v(d,typeof e!="symbol"?e+"":e,t);import{O as u}from"./index-62P_XJ2k.js";class S{static async processWithReasoning(e,t,s){const n=Date.now();try{const o=this.buildReasoningPrompt(e,t,s),a=await u.generateChatResponse({query:o,context:t,conversationHistory:[]});return{...this.parseReasoningResponse(a),processing_time:Date.now()-n}}catch(o){return console.error("Chain-of-thought processing failed:",o),this.generateFallbackReasoning(e,Date.now()-n)}}static buildReasoningPrompt(e,t,s){const n=this.getReasoningStrategy(s.primaryIntent);return`Think through this productivity question step by step:

QUERY: "${e}"

Use this reasoning framework:
${n}

AVAILABLE DATA: ${t}

Provide your analysis in this exact format:
STEP 1: [Title]
Analysis: [Your analysis]
Confidence: [0.0-1.0]
Data Points: [Specific data used]

STEP 2: [Title]  
Analysis: [Your analysis]
Confidence: [0.0-1.0]
Data Points: [Specific data used]

STEP 3: [Title]
Analysis: [Your analysis]
Confidence: [0.0-1.0]
Data Points: [Specific data used]

FINAL CONCLUSION: [Comprehensive answer based on reasoning]
OVERALL CONFIDENCE: [0.0-1.0]`}static getReasoningStrategy(e){const t={task_priority:`
1. DATA ASSESSMENT: Examine available task and session data
2. PRIORITY ANALYSIS: Evaluate urgency, importance, and dependencies  
3. RECOMMENDATION: Provide specific actionable next steps`,project_focus:`
1. PROJECT OVERVIEW: Analyze project status and progress metrics
2. RESOURCE ANALYSIS: Evaluate time allocation and completion patterns
3. STRATEGIC INSIGHTS: Identify optimization opportunities`,summary_insights:`
1. DATA COLLECTION: Gather relevant productivity metrics and patterns
2. PATTERN IDENTIFICATION: Identify trends and anomalies
3. INSIGHT GENERATION: Extract actionable productivity insights`,general:`
1. CONTEXT ANALYSIS: Understand the question and available data
2. INFORMATION SYNTHESIS: Connect relevant data points
3. ANSWER FORMULATION: Provide clear, specific response`};return t[e]||t.general}static parseReasoningResponse(e){const t=[];let s="",n=.7;const o=e.split(`
`);let a={};for(const r of o){const c=r.trim();if(c.startsWith("STEP ")){a.step&&t.push(a);const i=c.match(/STEP (\d+): (.+)/);i&&(a={step:parseInt(i[1]),title:i[2],confidence:.7,data_points:[]})}else if(c.startsWith("Analysis:"))a.analysis=c.substring(9).trim();else if(c.startsWith("Confidence:")){const i=c.match(/Confidence:\s*([\d.]+)/);i&&(a.confidence=Math.min(1,Math.max(0,parseFloat(i[1]))))}else if(c.startsWith("Data Points:")){const i=c.substring(12).trim();a.data_points=i?[i]:[]}else if(c.startsWith("FINAL CONCLUSION:"))s=c.substring(17).trim();else if(c.startsWith("OVERALL CONFIDENCE:")){const i=c.match(/OVERALL CONFIDENCE:\s*([\d.]+)/);i&&(n=Math.min(1,Math.max(0,parseFloat(i[1]))))}}return a.step&&t.push(a),{reasoning_steps:t,final_conclusion:s||"Analysis completed based on available data.",overall_confidence:n}}static generateFallbackReasoning(e,t){return{reasoning_steps:[{step:1,title:"Query Analysis",analysis:`Analyzing the query: "${e}"`,confidence:.5,data_points:["Query text analysis"]},{step:2,title:"Data Assessment",analysis:"Evaluating available productivity data for relevant information.",confidence:.5,data_points:["Available context"]},{step:3,title:"Response Formulation",analysis:"Generating response based on available information.",confidence:.5,data_points:["Context synthesis"]}],final_conclusion:"I processed your query but encountered some limitations. Please try rephrasing your question for better results.",overall_confidence:.5,processing_time:t}}}class y{static async validateResponse(e,t,s,n){const o=this.buildValidationPrompt(e,t,s,n);try{const a=await u.generateChatResponse({query:o,context:s,conversationHistory:[]});return this.parseValidationResponse(a)}catch(a){return console.error("Response validation failed:",a),this.generateFallbackValidation()}}static async performSelfCorrection(e,t,s,n){const o=Date.now();if(n.overall_score>.8)return{original_response:t,corrected_response:t,improvements:["No corrections needed - response quality is excellent"],validation_score:n.overall_score,processing_time:Date.now()-o};const a=this.buildCorrectionPrompt(e,t,s,n);try{const r=await u.generateChatResponse({query:a,context:s,conversationHistory:[]}),c=await this.validateResponse(e,r,s,[]);return{original_response:t,corrected_response:r,improvements:this.identifyImprovements(n),validation_score:c.overall_score,processing_time:Date.now()-o}}catch(r){return console.error("Self-correction failed:",r),{original_response:t,corrected_response:t,improvements:["Correction process failed - using original response"],validation_score:n.overall_score,processing_time:Date.now()-o}}}static buildValidationPrompt(e,t,s,n){return`Evaluate this AI response for quality and directness:

USER QUERY: "${e}"

AI RESPONSE TO EVALUATE:
${t}

VALIDATION CRITERIA:
1. DIRECTNESS: Does it answer exactly what was asked without extra information?
2. BREVITY: Is it concise and to the point?
3. RELEVANCE: Is all information directly related to the question?
4. COMPLETENESS: Are essential details included (but not more)?

Rate each criterion 0.0-1.0 and provide overall score.

SCORE: [0.0-1.0]
ISSUES:
- [issue type]: [brief description]
CORRECTIONS NEEDED:
- [specific correction to make it more direct]

VALIDATION: [PASS/FAIL]`}static buildCorrectionPrompt(e,t,s,n){const o=n.issues.map(r=>`${r.type}: ${r.description}`).join(`
`),a=n.corrections.join(`
`);return`Make this response more direct and focused:

ORIGINAL QUERY: "${e}"

ORIGINAL RESPONSE:
${t}

ISSUES TO FIX:
${o}

IMPROVEMENTS NEEDED:
${a}

CONTEXT:
${s.substring(0,300)}...

Provide a more direct, focused response that:
1. Answers exactly what was asked
2. Removes unnecessary information
3. Keeps only essential details
4. Is brief and scannable

IMPROVED RESPONSE:`}static parseValidationResponse(e){const t=e.split(`
`);let s=.7,n=.7,o=!0;const a=[],r=[];for(const c of t){const i=c.trim();if(i.startsWith("OVERALL SCORE:")){const l=i.match(/OVERALL SCORE:\s*([\d.]+)/);l&&(s=Math.min(1,Math.max(0,parseFloat(l[1]))))}else if(i.startsWith("CONFIDENCE:")){const l=i.match(/CONFIDENCE:\s*([\d.]+)/);l&&(n=Math.min(1,Math.max(0,parseFloat(l[1]))))}else if(i.startsWith("VALIDATION:"))o=i.includes("PASS");else if(i.startsWith("- Type:")){const l=this.parseValidationIssue(i);l&&a.push(l)}else i.startsWith("- ")&&!i.includes("Type:")&&r.push(i.substring(2))}return{isValid:o&&s>.6,confidence:n,issues:a,corrections:r,overall_score:s}}static parseValidationIssue(e){var a,r;const t=e.match(/Type:\s*(\w+)/),s=e.match(/Severity:\s*(\w+)/),n=e.match(/Description:\s*(.+?)(?:Suggestion:|$)/),o=e.match(/Suggestion:\s*(.+)/);return!t||!s?null:{type:t[1],severity:s[1],description:((a=n==null?void 0:n[1])==null?void 0:a.trim())||"Issue identified",suggestion:((r=o==null?void 0:o[1])==null?void 0:r.trim())||"Review and improve"}}static identifyImprovements(e){return e.issues.map(t=>`Addressed ${t.type} issue: ${t.suggestion}`)}static generateFallbackValidation(){return{isValid:!0,confidence:.6,issues:[],corrections:[],overall_score:.7}}static quickQualityCheck(e,t){const s=[];let n=1;e.length<50?(s.push("Response too short"),n-=.3):e.length>2e3&&(s.push("Response too long"),n-=.1),/I don't have|I cannot|I'm unable/i.test(e)&&(s.push("Generic negative response"),n-=.2);const o=t.toLowerCase().split(" ").filter(i=>i.length>3),a=e.toLowerCase();return o.filter(i=>a.includes(i)).length/Math.max(1,o.length)<.3&&(s.push("Low query relevance"),n-=.2),{score:Math.max(0,n),issues:s}}}class I{static async processWithAdvancedPrompting(e,t,s,n=[],o={}){const a=Date.now(),r={...this.DEFAULT_OPTIONS,...o};console.log("🎯 Advanced prompt processing started:",{query:e.substring(0,50)+"...",classification:s.primaryIntent,confidence:s.confidence});try{const c=this.determineProcessingStrategy(e,s,r);console.log("📋 Processing strategy:",c);let i,l=null;c==="chain_of_thought"&&r.enable_chain_of_thought?(l=await S.processWithReasoning(e,t,s),i=l.final_conclusion,console.log("🧠 Chain-of-thought applied, confidence:",l.overall_confidence)):(i=await this.generateEnhancedResponse(e,t,n),console.log("✨ Enhanced response generated"));let p=null,h=null;r.enable_validation&&(p=await y.validateResponse(e,i,t,[]),console.log("🔍 Response validated, score:",p.overall_score),r.enable_self_correction&&p.overall_score<r.validation_threshold&&(h=await y.performSelfCorrection(e,i,t,p),i=h.corrected_response,console.log("🔧 Self-correction applied, new score:",h.validation_score)));const m=this.calculateFinalConfidence(s.confidence,l==null?void 0:l.overall_confidence,p==null?void 0:p.confidence),f={response:i,reasoning:l,validation:p,correction:h,confidence:m,processing_time:Date.now()-a,technique_used:c};return console.log("🎉 Advanced prompt processing complete:",{technique:c,confidence:m,time:f.processing_time+"ms"}),f}catch(c){return console.error("❌ Advanced prompt processing failed:",c),this.generateFallbackResult(e,t,n,Date.now()-a)}}static determineProcessingStrategy(e,t,s){return this.assessQueryComplexity(e,t)>s.complexity_threshold&&s.enable_chain_of_thought?"chain_of_thought":s.enable_validation?"validated_response":"standard"}static assessQueryComplexity(e,t){let s=.3;const n=e.split(" ").length,o=/analyz|insight|pattern|trend|optimiz|strateg|compar|evaluat/i.test(e),a=(e.match(/\band\b|\bor\b/g)||[]).length,r=/how|why|what|when|where|which/i.test(e);return n>15?s+=.3:n>10?s+=.2:n>5&&(s+=.1),o&&(s+=.2),s+=Math.min(.2,a*.1),r&&(s+=.1),s+=(1-t.confidence)*.2,Math.min(1,s)}static async generateEnhancedResponse(e,t,s){const n=this.getDefaultSystemPrompt(t),o=this.addFewShotExamples(e,n),a=new Date,r=a.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),c=a.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:!0}),i=`${o}

CURRENT DATE & TIME: ${r} at ${c}
IMPORTANT: When answering questions about "today", "now", or current time, use the above current date/time, NOT dates from the productivity data context.

Context: ${t}`;return await u.generateChatResponse({query:e,context:i,conversationHistory:s})}static getDefaultSystemPrompt(e){return`You are a helpful productivity AI assistant. Provide direct, focused answers based on user data.

RESPONSE STYLE:
- Answer exactly what was asked
- Keep responses brief and scannable  
- Include only essential information
- Focus on actionable insights

Available Context: ${e}`}static addFewShotExamples(e,t){const s=e.toLowerCase();let n="";return s.includes("productiv")||s.includes("pattern")?n=`
Example: "How productive was I this week?" → "12 tasks completed, 18.5 hours focused work. Peak days: Tuesday, Thursday."
Example: "What patterns do you see?" → "You're 25% more effective with deadlines. Best focus: 25-30 minute sessions."`:(s.includes("task")||s.includes("priority"))&&(n=`
Example: "What should I work on next?" → "API Integration task - 2 days overdue, blocks 3 other tasks."
Example: "Which tasks are slow?" → "Database Optimization: 180% over estimate. Consider breaking into subtasks."`),n&&(t+=`

Examples of good responses:${n}

Use this style - direct and specific.`),t}static calculateFinalConfidence(e,t=.7,s=.7){const n={classification:.4,reasoning:.3,validation:.3};return e*n.classification+t*n.reasoning+s*n.validation}static async generateFallbackResult(e,t,s,n){try{return{response:await u.generateChatResponse({query:e,context:t,conversationHistory:s}),reasoning:null,validation:null,correction:null,confidence:.6,processing_time:n,technique_used:"standard"}}catch{return{response:"I apologize, but I encountered an error processing your request. Please try again.",reasoning:null,validation:null,correction:null,confidence:.3,processing_time:n,technique_used:"standard"}}}}g(I,"DEFAULT_OPTIONS",{enable_chain_of_thought:!0,enable_validation:!0,enable_self_correction:!0,complexity_threshold:.6,validation_threshold:.7});export{I as AdvancedPromptService};
