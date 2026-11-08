import assert from'node:assert/strict';
import test from'node:test';
import{learningCatalogResponse,learningCompletionReceipt,learningLessonResponse,learningUnavailable}from'../src/learning-reader.js';
const lesson={id:'50000000-0000-4000-8000-000000001501',slug:'original-fictional-observation',exam:'ceed',topic:'observation',title:'Original Fictional Observation',summary:'An original fictional summary for learning verification.',body:'An original fictional theory body for learning verification.',completed:false};
const progress={total:1,completed:0,percent:0,recommendation:{id:lesson.id,slug:lesson.slug,exam:lesson.exam,topic:lesson.topic,title:lesson.title,answered:0,accuracy:null,reason:'Recommended as an incomplete fictional lesson.'}};
test('learning catalogue projects safe records and the matching owned recommendation',()=>{
 const result=learningCatalogResponse([{...lesson,privateOperatorField:'excluded'}],progress);assert.equal(result.lessons[0].id,lesson.id);assert.equal(result.lessons[0].body,undefined);assert.equal(result.lessons[0].privateOperatorField,undefined);assert.notEqual(result.progress.recommendation,progress.recommendation);assert.equal(result.progress.recommendation.accuracy,null);
 assert.deepEqual(learningCatalogResponse([],{total:0,completed:0,percent:0}),{lessons:[],progress:{total:0,completed:0,percent:0,recommendation:null}});
});
test('learning catalogue refuses invalid lesson types, duplicate identities and incoherent progress',()=>{
 for(const rows of[null,{},[null],[{...lesson,completed:'false'}],[{...lesson,exam:'unsupported'}],[{...lesson,id:'invalid'}],[lesson,lesson],[lesson,{...lesson,id:'50000000-0000-4000-8000-000000001502'}]])assert.throws(()=>learningCatalogResponse(rows,progress),/could not be verified/);
 for(const value of[{...progress,total:2},{...progress,completed:1},{...progress,percent:50},{...progress,total:1.5},{...progress,recommendation:{...progress.recommendation,answered:0,accuracy:50}},{...progress,recommendation:{...progress.recommendation,id:'50000000-0000-4000-8000-000000001502'}},{...progress,recommendation:{...progress.recommendation,exam:'uceed'}}])assert.throws(()=>learningCatalogResponse([lesson],value),/could not be verified/);
});
test('lesson reads retain exact text and Unicode limits while excluding unknown fields',()=>{
 const value={...lesson,body:'🎨'.repeat(50000),privateOperatorField:'excluded'},result=learningLessonResponse(value,lesson);assert.equal([...result.body].length,50000);assert.equal(result.privateOperatorField,undefined);assert.notEqual(result,value);
});
test('a lesson response cannot substitute identity, slug, scalar flags or an invalid body',()=>{
 for(const value of[null,{...lesson,id:'50000000-0000-4000-8000-000000001502'},{...lesson,slug:'another-slug'},{...lesson,completed:'true'},{...lesson,body:'short'},{...lesson,body:'🎨'.repeat(50001)},{...lesson,title:'x'},{...lesson,summary:'short'}])assert.throws(()=>learningLessonResponse(value,lesson),/could not be verified/);
});
test('completion accepts only its exact void receipt',()=>{
 assert.equal(learningCompletionReceipt(null),undefined);for(const value of[undefined,true,false,{},[],lesson.id])assert.throws(()=>learningCompletionReceipt(value),/could not be verified/);
});
test('only the known withdrawn-lesson error has a publication-specific recovery',()=>{
 assert.equal(learningUnavailable({code:'P0001',message:'Lesson not found'}),true);for(const value of[null,{message:'Lesson not found'},{code:'42501',message:'Lesson not found'},{code:'P0001',message:'Private fictional provider diagnostic'}])assert.equal(learningUnavailable(value),false);
});
