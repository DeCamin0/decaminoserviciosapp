import { Info } from 'lucide-react';

const FACTORS = [
  {
    title: 'Cumplimiento de Horas (30%)',
    text: 'Mide si cumples con las horas de trabajo asignadas comparando las horas fichadas con tu objetivo mensual.',
  },
  {
    title: 'Calidad del Fichaje (20%)',
    text: 'Evalúa entradas/salidas correctas, fichajes incompletos y regularizaciones necesarias.',
  },
  {
    title: 'Puntualidad (10%)',
    text: 'Considera si fichas a la hora según tu horario asignado.',
  },
  {
    title: 'Uso de la Aplicación (10%)',
    text: 'Frecuencia de uso de la app para fichar, consultar información y realizar acciones.',
  },
  {
    title: 'Responsabilidad Digital (30%)',
    text: 'Gestión de documentos, plazos digitales y uso adecuado de las plataformas de trabajo.',
  },
];

export default function HallOfFameHowItWorks() {
  return (
    <section className="hof-how app-card">
      <div className="hof-how__head">
        <Info className="w-5 h-5 shrink-0 text-[var(--primary-color,#E53935)]" aria-hidden />
        <h3 className="hof-how__title">¿Cómo funciona?</h3>
      </div>
      <p className="hof-how__intro">
        El ranking se calcula mensualmente teniendo en cuenta los siguientes factores:
      </p>
      <ul className="hof-how__list">
        {FACTORS.map((f) => (
          <li key={f.title}>
            <p className="hof-how__factor-title">{f.title}</p>
            <p className="hof-how__factor-text">{f.text}</p>
          </li>
        ))}
      </ul>
      <p className="hof-how__tip">
        La posición puede variar cada mes. El objetivo es reconocer el esfuerzo y la mejora continua.
      </p>
    </section>
  );
}
