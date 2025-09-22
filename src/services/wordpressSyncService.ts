import axios from 'axios';
import { Event } from '../models/event';

interface WordPressEvent {
  id: number;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  date: string;
  date_gmt: string;
  modified: string;
  status: string;
  type: string; // 'post' o 'event'
  featured_media: number;
  categories: number[];
  tags: number[];
  meta: {
    event_start_date?: string;
    event_end_date?: string;
    event_start_time?: string;
    event_end_time?: string;
    event_location?: string;
    event_category?: string;
    event_status?: string;
    [key: string]: any;
  };
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      id: number;
      source_url: string;
    }>;
    'wp:term'?: Array<{
      id: number;
      name: string;
      slug: string;
      taxonomy: string;
    }>;
  };
}

interface SyncResult {
  success: boolean;
  message: string;
  newEventsCount: number;
  updatedEventsCount: number;
  errors: string[];
}

export class WordPressSyncService {
  private static readonly WORDPRESS_API_URL = process.env.WORDPRESS_API_URL;
  private static readonly WORDPRESS_TOKEN = process.env.WORDPRESS_API_KEY;

  static async syncEvents(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      message: '',
      newEventsCount: 0,
      updatedEventsCount: 0,
      errors: []
    };

    try {
      console.log('WordPressSyncService: Iniciando sincronización...');

      const wordpressEvents = await this.fetchWordPressEvents();
      console.log(`WordPressSyncService: Obtenidos ${wordpressEvents.length} eventos de WordPress`);

      if (wordpressEvents.length === 0) {
        result.message = 'No hay eventos nuevos disponibles. Está al día con la información más reciente.';
        return result;
      }

      const validEvents = this.filterValidEvents(wordpressEvents);
      console.log(`WordPressSyncService: ${validEvents.length} eventos válidos después del filtrado`);

      if (validEvents.length === 0) {
        result.message = 'No hay eventos nuevos válidos para sincronizar. Está al día con la información más reciente.';
        return result;
      }

      for (const wpEvent of validEvents) {
        try {
          console.log(`WordPressSyncService: Procesando evento ${wpEvent.id}: "${wpEvent.title.rendered}"`);
          
          const eventExists = await this.checkEventExists(wpEvent.id.toString());
          
          if (eventExists) {
            console.log(`WordPressSyncService: Evento ${wpEvent.id} ya existe en la base de datos, omitiendo...`);
            continue;
          }

          console.log(`WordPressSyncService: Evento ${wpEvent.id} es nuevo, creando...`);
          const newEvent = await this.createEventFromWordPress(wpEvent);
          
          if (newEvent) {
            result.newEventsCount++;
            console.log(`WordPressSyncService: ✅ Evento ${wpEvent.id} sincronizado exitosamente`);
          } else {
            console.log(`WordPressSyncService: ⚠️ Evento ${wpEvent.id} no se pudo crear (posiblemente ya pasó)`);
          }
        } catch (error) {
          const errorMsg = `Error procesando evento ${wpEvent.id}: ${error}`;
          result.errors.push(errorMsg);
          console.error(`WordPressSyncService: ❌ ${errorMsg}`);
        }
      }

      if (result.newEventsCount > 0) {
        result.message = `Sincronización exitosa. Se agregaron ${result.newEventsCount} eventos nuevos.`;
      } else {
        result.message = 'No hay eventos nuevos para sincronizar. Está al día con la información más reciente.';
      }

      if (result.errors.length > 0) {
        result.message += ` Se encontraron ${result.errors.length} errores durante el proceso.`;
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.message = 'Error durante la sincronización: ' + error;
      result.errors.push(result.message);
      console.error('WordPressSyncService: Error general:', error);
    }

    return result;
  }

  private static async fetchWordPressEvents(): Promise<WordPressEvent[]> {
    try {
      if (!this.WORDPRESS_API_URL || !this.WORDPRESS_TOKEN) {
        throw new Error('Variables de entorno de WordPress no configuradas');
      }

      // Intentar primero con posts (endpoint estándar de WordPress)
      let response;
      try {
        response = await axios.get(`${this.WORDPRESS_API_URL}/posts`, {
          headers: {
            'Authorization': `Bearer ${this.WORDPRESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          params: {
            per_page: 100,
            status: 'publish',
            _embed: true,
            orderby: 'date',
            order: 'desc'
          }
        });
      } catch (error) {
        response = await axios.get(`${this.WORDPRESS_API_URL}/events`, {
          headers: {
            'Authorization': `Bearer ${this.WORDPRESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          params: {
            per_page: 100,
            status: 'publish',
            _embed: true,
            orderby: 'date',
            order: 'desc'
          }
        });
      }

      return response.data || [];
    } catch (error) {
      console.error('WordPressSyncService: Error obteniendo eventos de WordPress:', error);
      throw new Error('No se pudieron obtener los eventos de WordPress');
    }
  }

  private static filterValidEvents(events: WordPressEvent[]): WordPressEvent[] {
    return events.filter(event => {
      // 1. Verificar que el evento no esté cancelado
      if (event.status === 'cancelled' || event.status === 'canceled' || 
          event.meta.event_status === 'cancelled' || event.meta.event_status === 'canceled') {
        return false;
      }

      // 2. Verificar que el evento no haya pasado
      const eventDate = event.meta.event_start_date || event.date;
      if (eventDate) {
        const eventDateTime = new Date(eventDate);
        const now = new Date();
        // Restar 1 hora para permitir eventos que empiezan pronto
        now.setHours(now.getHours() - 1);
        
        if (eventDateTime < now) {
          return false;
        }
      }

      // 3. Verificar que tenga categoría cacaoToken (para posts o eventos)
      const hasCacaoTokenCategory = event._embedded?.['wp:term']?.some(term => 
        (term.taxonomy === 'event_category' || term.taxonomy === 'category') && 
        (term.name.toLowerCase().includes('cacaotoken') || 
         term.slug.toLowerCase().includes('cacaotoken'))
      );

      const metaHasCacaoToken = event.meta.event_category?.toLowerCase().includes('cacaotoken');
      
      // También verificar en el título y contenido si es un evento
      const titleHasEvent = event.title.rendered.toLowerCase().includes('evento') || 
                           event.title.rendered.toLowerCase().includes('event');
      const contentHasEvent = event.content.rendered.toLowerCase().includes('evento') || 
                             event.content.rendered.toLowerCase().includes('event');

      if (!hasCacaoTokenCategory && !metaHasCacaoToken && !titleHasEvent && !contentHasEvent) {
        return false;
      }

      // 4. Verificar que tenga título válido
      if (!event.title.rendered || event.title.rendered.trim().length === 0) {
        return false;
      }

      // 5. Verificar que tenga fecha válida
      if (!eventDate || isNaN(new Date(eventDate).getTime())) {
        return false;
      }

      return true;
    });
  }

  private static async checkEventExists(wordpressId: string): Promise<boolean> {
    try {
      const existingEvent = await Event.findOne({ wordpressId });
      return !!existingEvent;
    } catch (error) {
      console.error('WordPressSyncService: Error verificando evento existente:', error);
      return false;
    }
  }

  private static async createEventFromWordPress(wpEvent: WordPressEvent): Promise<any> {
    try {
      const title = wpEvent.title.rendered.trim();
      const description = this.cleanHtml(wpEvent.excerpt.rendered || wpEvent.content.rendered);
      const location = wpEvent.meta.event_location?.trim() || 'Ubicación por confirmar';
      
      const eventDate = wpEvent.meta.event_start_date || wpEvent.date;
      const eventTime = wpEvent.meta.event_start_time || '00:00';
      
      // Verificar que el evento sea futuro antes de crearlo
      const eventDateTime = new Date(eventDate);
      const now = new Date();
      if (eventDateTime < now) {
        return null;
      }

      const imageUrl = this.extractImageUrl(wpEvent);
      const categoryId = this.mapWordPressCategory(wpEvent);

      // Determinar si el evento está activo basado en el estado de WordPress
      const isActive = wpEvent.status === 'publish' && 
                      wpEvent.meta.event_status !== 'cancelled' && 
                      wpEvent.meta.event_status !== 'canceled';

      const newEvent = new Event({
        title,
        description,
        location,
        date: eventDateTime,
        time: eventTime,
        createdBy: 'wordpress_sync',
        isActive,
        imageUrl,
        minTokens: 10,
        maxTokens: 100,
        categoryId,
        wordpressId: wpEvent.id.toString(),
        source: 'wordpress',
        isReadOnly: true
      });

      const savedEvent = await newEvent.save();
      return savedEvent;

    } catch (error) {
      console.error('WordPressSyncService: Error creando evento:', error);
      throw error;
    }
  }

  private static cleanHtml(html: string): string {
    if (!html) return '';
    
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private static extractImageUrl(wpEvent: WordPressEvent): string | undefined {
    if (wpEvent._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
      return wpEvent._embedded['wp:featuredmedia'][0].source_url;
    }

    if (wpEvent.meta.event_image_url) {
      return wpEvent.meta.event_image_url;
    }

    return undefined;
  }

  private static mapWordPressCategory(wpEvent: WordPressEvent): string {
    const categoryMapping: { [key: string]: string } = {
      'deportes': '2',
      'cultura': '6',
      'conciertos': '6',
      'arte': '6',
      'familiares': '3',
      'comunidad': '4',
    };

    const wpCategories = wpEvent._embedded?.['wp:term']?.filter(term => term.taxonomy === 'event_category') || [];
    
    for (const category of wpCategories) {
      const categorySlug = category.slug.toLowerCase();
      const categoryName = category.name.toLowerCase();
      
      for (const [key, value] of Object.entries(categoryMapping)) {
        if (categorySlug.includes(key) || categoryName.includes(key)) {
          return value;
        }
      }
    }

    return '6';
  }
}
