-- Stage 12 pilot: two source-traceable Mathematics scheme rows, intentionally pending human review.

with doc as (
  select id from public.scheme_documents where original_filename='Mathematics JSS 1-3 Edudelight.com.pdf'
), batch as (
  insert into public.scheme_ingestion_batches(document_id,status,extraction_method,row_count,notes)
  select id,'review','manual',1,'Pilot transcribed from supplied PDF page 1; pending review.' from doc
  returning id,document_id
)
insert into public.scheme_entries(document_id,batch_id,class_level,term,week_label,week_number,subject_name,topic,learning_objectives,learning_activities,embedded_core_skills,learning_resources,source_page,source_reference,normalized_key)
select b.document_id,b.id,'JSS1','First Term','Week 1',1,'Mathematics',
       'Whole Numbers — counting and writing in millions, billions and trillions; quantitative reasoning',
       jsonb_build_array('Identify millions among numbers.','Differentiate between millions and billions.','Recognise trillions as a number.','Apply large numbers in real-life situations.','Solve quantitative-reasoning exercises related to millions, billions and trillions.'),
       jsonb_build_array('Use labelled large-number cards and group identification activities with millions, billions and trillions.'),
       jsonb_build_array('Critical thinking','Collaboration','Leadership and personal development'),
       jsonb_build_array('Number cards','Charts containing counting of bigger numbers'),
       1,'Supplied Mathematics JSS1-3 PDF, page 1','jss1:first:week1:mathematics:whole-numbers'
from batch b
on conflict (document_id,normalized_key) do nothing;

update public.scheme_documents set extraction_status='staged',updated_at=now() where original_filename='Mathematics JSS 1-3 Edudelight.com.pdf';

with doc as (
  select id from public.scheme_documents where original_filename='Mathematics SS1 - SS3.pdf'
), batch as (
  insert into public.scheme_ingestion_batches(document_id,status,extraction_method,row_count,notes)
  select id,'review','manual',1,'Pilot transcribed from supplied PDF page 1; pending review.' from doc
  returning id,document_id
)
insert into public.scheme_entries(document_id,batch_id,class_level,term,week_label,week_number,subject_name,topic,learning_objectives,learning_activities,embedded_core_skills,learning_resources,source_page,source_reference,normalized_key)
select b.document_id,b.id,'SS1','First Term','Week 2',2,'Mathematics',
       'Conversion between number bases and base ten',
       jsonb_build_array('Describe various number systems.','Compare and convert numbers from base ten to binary.','Convert numbers from other bases to base ten.','Apply the use of the binary system in day-to-day activities.'),
       jsonb_build_array('Use conversion examples and guided practice to move numbers between bases.'),
       jsonb_build_array('Critical thinking and problem solving','Collaboration and communication','Digital literacy'),
       jsonb_build_array('Audio-visual resources','Charts showing conversion between number systems'),
       1,'Supplied Mathematics SS1-SS3 PDF, page 1','ss1:first:week2:mathematics:number-bases'
from batch b
on conflict (document_id,normalized_key) do nothing;

update public.scheme_documents set extraction_status='staged',updated_at=now() where original_filename='Mathematics SS1 - SS3.pdf';
