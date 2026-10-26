// Estas duas informações são públicas por natureza (a segurança está nas regras do banco).
// NUNCA coloque aqui a chave secreta / service_role.
window.APOSTILA_CONFIG = {
  supabaseUrl: 'https://qrlaklogimoedmobqpfo.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybGFrbG9naW1vZWRtb2JxcGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODA5ODUsImV4cCI6MjEwODU1Njk4NX0.28-Bcr6ArS9hC1obW8DHdOACfDMrjVu3bp_LRe5EDbs',
  nomeDesafio: 'Desafio UGC de 15 dias',
  totalDias: 15,
  boasVindas: 'Um dia abre por vez. Faça a tarefa, envie no grupo e marque o checklist. Vamos descobrir e fazer isso juntas.',
  // Os dias agrupados no menu. Mude os nomes ou os números dos dias como quiser.
  etapas: [
    { nome: 'Comece aqui', dias: [1, 2] },
    { nome: 'Observar e planejar', dias: [3, 4, 5] },
    { nome: 'Preparar e gravar', dias: [6, 7, 8, 9] },
    { nome: 'Fotos e edição', dias: [10, 11, 12] },
    { nome: 'Portfólio e entrega', dias: [13, 14, 15] },
  ],
};
