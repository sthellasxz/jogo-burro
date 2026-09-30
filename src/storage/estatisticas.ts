import type { RegistroPartida } from './types';
/** Números resumidos do histórico do jogador neste aparelho. */
export interface Estatisticas { 
    total: number; 
    vitorias: number; 
    vezesBurro: number; 
    interrompidas: number; 
    /** Porcentagem de vitórias entre as partidas finalizadas (0 a 100). */ 
    aproveitamento: number;
}
export function calcularEstatisticas(registros: RegistroPartida[]): Estatisticas { 
    const finalizadas = registros.filter((r) => r.status === 'finalizada'); 
    const vitorias = registros.filter((r) => r.resultadoLocal === 'vitoria').length; 
    const vezesBurro = registros.filter((r) => r.resultadoLocal === 'burro').length; 
    return { 
        total: registros.length, 
        vitorias, 
        vezesBurro, 
        interrompidas: registros.length - finalizadas.length, 
        aproveitamento: finalizadas.length > 0 ? Math.round((vitorias / finalizadas.length) * 100) : 0, 
    };
}
