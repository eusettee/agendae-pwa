const specialties = ['Clínica Geral', 'Ortopedia', 'Dermatologia', 'Cardiologia', 'Pediatria'];
const clinics = [
  { id: 'boa-vista', name: 'Unidade Boa Vista', address: 'Boa Vista, Recife', professionals: [
    { id: 'ana', name: 'Dra. Ana Lima', specialty: 'Clínica Geral' },
    { id: 'pedro', name: 'Dr. Pedro Costa', specialty: 'Ortopedia' }
  ] },
  { id: 'ilha-do-leite', name: 'Unidade Ilha do Leite', address: 'Ilha do Leite, Recife', professionals: [
    { id: 'julia', name: 'Dra. Júlia Alves', specialty: 'Dermatologia' },
    { id: 'marcos', name: 'Dr. Marcos Melo', specialty: 'Cardiologia' }
  ] },
  { id: 'derby', name: 'Unidade Derby', address: 'Derby, Recife', professionals: [
    { id: 'luiza', name: 'Dra. Luiza Silva', specialty: 'Pediatria' },
    { id: 'rafael', name: 'Dr. Rafael Souza', specialty: 'Clínica Geral' }
  ] }
];
const times = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
module.exports = { specialties, clinics, times, demo: true };
