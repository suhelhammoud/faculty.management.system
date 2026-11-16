CREATE TABLE "hr_request_documents" (
	"request_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_request_documents_request_document_unique" UNIQUE("request_id","document_id")
);
--> statement-breakpoint
ALTER TABLE "hr_request_documents" ADD CONSTRAINT "hr_request_documents_request_id_hr_requests_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."hr_requests"("request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_request_documents" ADD CONSTRAINT "hr_request_documents_document_id_hr_documents_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."hr_documents"("document_id") ON DELETE cascade ON UPDATE no action;