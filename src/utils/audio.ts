/**
 * Servicio de Notificaciones Auditivas (Pitido, Campanilla y Síntesis de Voz)
 * Soporta dos modalidades a elección del funcionario:
 * 1. 'VOZ': Campanilla/pitido seguido de locución clara con nombre del ciudadano y número de caja.
 * 2. 'PITIDO': Alerta sonora institucional sin locución verbal.
 */
class AudioNotificationService {
  private audioCtx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Genera el timbre/pitido armónico institucional (dos tonos armónicos Fa#5 -> Si5)
   */
  public playChime(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Primer tono (Fa#5 ~ 740 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(739.99, now);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.85);

      // Segundo tono armónico más agudo (Si5 ~ 987 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.22);

      gain2.gain.setValueAtTime(0, now + 0.22);
      gain2.gain.linearRampToValueAtTime(0.38, now + 0.26);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 1.4);
    } catch (err) {
      console.warn('Audio no disponible o bloqueado por política de autoplay del navegador:', err);
    }
  }

  /**
   * Sintetiza la voz por el altavoz en español anunciando al ciudadano y la caja de atención.
   */
  public speak(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      // Cancelar cualquier locución previa en cola
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 0.94; // Velocidad pausada y comprensible
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Intentar seleccionar la voz en español más natural disponible en el sistema
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(v => v.lang.startsWith('es') || v.lang.includes('Spanish'));
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Error en síntesis de voz del navegador:', err);
    }
  }

  /**
   * Ejecuta el llamado según el modo configurado por la caja:
   * - Si modo es 'VOZ': Suena el pitido/campanilla y luego vocaliza el nombre del ciudadano y la caja.
   * - Si modo es 'PITIDO': Suena únicamente el pitido/campanilla.
   */
  public playCallNotification(params: {
    modo?: 'VOZ' | 'PITIDO';
    codigo: string;
    cajaNumero: number | string;
    destinoTipo?: 'CAJA' | 'TRIADA';
    nombre?: string | null;
    apellido?: string | null;
  }): void {
    // 1. Siempre reproducir el pitido/campanilla
    this.playChime();

    // 2. Si el modo es 'VOZ', pronunciar el llamado por nombre
    if (params.modo !== 'PITIDO') {
      const nombreCompleto = [params.nombre, params.apellido].filter(Boolean).join(' ').trim();
      const numCaja = Number(params.cajaNumero);
      const estacionTexto = params.destinoTipo === 'TRIADA' 
        ? `Triada ${params.cajaNumero}` 
        : (numCaja === 0 ? `la Caja Cero Preferencial` : `la Caja ${params.cajaNumero}`);

      let textoVocal: string;

      if (nombreCompleto) {
        textoVocal = `Turno ${params.codigo}. ${nombreCompleto}. Por favor acercarse a ${estacionTexto}.`;
      } else {
        textoVocal = `Turno ${params.codigo}. Por favor acercarse a ${estacionTexto}.`;
      }

      // Retardo de 650 ms para que suene la campanilla antes de comenzar a hablar
      setTimeout(() => {
        this.speak(textoVocal);
      }, 650);
    }
  }
}

export const soundManager = new AudioNotificationService();
