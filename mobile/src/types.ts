export type User = { id: string; name: string; email: string };
export type Appointment = { id: string; patient: string; clinicId: string; professionalId: string; date: string; time: string };
export type Professional = { id: string; name: string; specialty: string };
export type Clinic = { id: string; name: string; address: string; professionals: Professional[] };
export type Catalog = { specialties: string[]; clinics: Clinic[]; times: string[]; demo: boolean };
export type Triage = { source: 'ai' | 'manual' | 'safety'; urgent: boolean; specialty: string | null; confidence: string; notice: string; message?: string };
