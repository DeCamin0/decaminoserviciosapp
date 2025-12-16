// Sistem de logging pentru activitatea utilizatorilor
import { routes } from './routes.js';

class ActivityLogger {
  constructor() {
    this.baseUrl = routes.logActivity;
  }

  // Funcție pentru a obține informații detaliate despre browser
  getBrowserInfo() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;
    const cookieEnabled = navigator.cookieEnabled;
    const onLine = navigator.onLine;
    const screenInfo = {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    };
    const windowInfo = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight
    };

    // Detectare browser și versiune
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    let osName = 'Unknown';

    // Detectare Chrome
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browserName = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }
    // Detectare Firefox
    else if (userAgent.includes('Firefox')) {
      browserName = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }
    // Detectare Safari
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browserName = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }
    // Detectare Edge
    else if (userAgent.includes('Edg')) {
      browserName = 'Edge';
      const match = userAgent.match(/Edg\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }
    // Detectare Opera
    else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      browserName = 'Opera';
      const match = userAgent.match(/(?:Opera|OPR)\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }

    // Detectare sistem de operare
    if (userAgent.includes('Windows')) {
      osName = 'Windows';
      if (userAgent.includes('Windows NT 10.0')) osName = 'Windows 10/11';
      else if (userAgent.includes('Windows NT 6.3')) osName = 'Windows 8.1';
      else if (userAgent.includes('Windows NT 6.2')) osName = 'Windows 8';
      else if (userAgent.includes('Windows NT 6.1')) osName = 'Windows 7';
    } else if (userAgent.includes('Mac OS X')) {
      osName = 'macOS';
      const match = userAgent.match(/Mac OS X (\d+)_(\d+)/);
      if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);
        if (major === 10) {
          if (minor >= 15) osName = 'macOS Catalina+';
          else if (minor >= 14) osName = 'macOS Mojave';
          else if (minor >= 13) osName = 'macOS High Sierra';
        }
      }
    } else if (userAgent.includes('Linux')) {
      osName = 'Linux';
    } else if (userAgent.includes('Android')) {
      osName = 'Android';
    } else if (userAgent.includes('iOS')) {
      osName = 'iOS';
    }

    return {
      userAgent: userAgent,
      browser: {
        name: browserName,
        version: browserVersion,
        fullName: `${browserName} ${browserVersion}`
      },
      os: {
        name: osName,
        platform: platform
      },
      language: language,
      cookieEnabled: cookieEnabled,
      onLine: onLine,
      screen: screenInfo,
      window: windowInfo,
      timestamp: new Date().toISOString()
    };
  }

  // Log o acțiune
  async logAction(action, details = {}) {
    try {
      const browserInfo = this.getBrowserInfo();
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        details,
        browser: browserInfo,
        url: window.location.href,
        sessionId: this.getSessionId()
      };

      // Salvează local pentru backup
      this.saveLocalLog(logEntry);

      // Trimite la backend
      await this.sendToBackend(logEntry);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  // === LOGIN/LOGOUT ===
  async logLogin(user) {
    await this.logAction('login', {
      user: user['NOMBRE / APELLIDOS'] || user.nombre,
      email: user.email,
      grupo: user.GRUPO,
      role: user.role
    });
  }

  async logLogout(user) {
    // Non-blocking logout logging - direct sendToBackend
    try {
      const browserInfo = this.getBrowserInfo();
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        action: 'logout',
        details: {
          user: user['NOMBRE / APELLIDOS'] || user.nombre,
          email: user.email,
          grupo: user.GRUPO,
          role: user.role
        },
        browser: browserInfo,
        url: window.location.href,
        sessionId: this.getSessionId()
      };

      // Salvează local pentru backup
      this.saveLocalLog(logEntry);

      // Trimite la backend (non-blocking)
      this.sendToBackend(logEntry).catch(error => {
        console.error('Error sending logout to backend:', error);
      });
    } catch (error) {
      console.error('Error in logLogout:', error);
    }
  }

  // === NAVIGARE ===
  async logPageAccess(page, user) {
    await this.logAction('page_access', {
      page,
      user: user['NOMBRE / APELLIDOS'] || user.nombre,
      email: user.email
    });
  }

  // === FICHAJE (PONTAJ) ===
  async logFichajeCreated(fichajeData, user) {
    // Non-blocking logging cu delay mai mic
    setTimeout(() => {
      this.logAction('fichaje_created', {
        fichaje: fichajeData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging fichaje created:', error);
      });
    }, 50); // Redus de la 100ms la 50ms
  }

  async logFichajeUpdated(fichajeData, user) {
    // Non-blocking logging cu delay mai mic
    setTimeout(() => {
      this.logAction('fichaje_updated', {
        fichaje: fichajeData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging fichaje updated:', error);
      });
    }, 50);
  }

  async logFichajeDeleted(fichajeData, user) {
    setTimeout(() => {
      this.logAction('fichaje_deleted', {
        fichaje: fichajeData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging fichaje deleted:', error);
      });
    }, 50);
  }

  // === CUADRANTES ===
  async logCuadranteGenerated(cuadranteData, user) {
    setTimeout(() => {
      this.logAction('cuadrante_generated', {
        cuadrante: cuadranteData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging cuadrante generated:', error);
      });
    }, 50);
  }

  async logCuadranteUpdated(cuadranteData, user) {
    setTimeout(() => {
      this.logAction('cuadrante_updated', {
        cuadrante: cuadranteData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging cuadrante updated:', error);
      });
    }, 50);
  }

  async logCuadranteSaved(cuadranteData, user) {
    setTimeout(() => {
      this.logAction('cuadrante_saved', {
        cuadrante: cuadranteData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging cuadrante saved:', error);
      });
    }, 50);
  }

  // === EMPLEADOS ===
  async logEmpleadoCreated(empleadoData, user) {
    setTimeout(() => {
      this.logAction('empleado_created', {
        empleado: empleadoData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging empleado created:', error);
      });
    }, 50);
  }

  async logEmpleadoUpdated(empleadoData, user) {
    setTimeout(() => {
      this.logAction('empleado_updated', {
        empleado: empleadoData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging empleado updated:', error);
      });
    }, 50);
  }

  async logEmpleadoDeleted(empleadoData, user) {
    setTimeout(() => {
      this.logAction('empleado_deleted', {
        empleado: empleadoData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging empleado deleted:', error);
      });
    }, 50);
  }

  // === SOLICITUDES ===
  async logSolicitudCreated(solicitudData, user) {
    setTimeout(() => {
      this.logAction('solicitud_created', {
        solicitud: solicitudData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging solicitud created:', error);
      });
    }, 50);
  }

  async logSolicitudUpdated(solicitudData, user) {
    setTimeout(() => {
      this.logAction('solicitud_updated', {
        solicitud: solicitudData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging solicitud updated:', error);
      });
    }, 50);
  }

  async logSolicitudApproved(solicitudData, user) {
    setTimeout(() => {
      this.logAction('solicitud_approved', {
        solicitud: solicitudData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging solicitud approved:', error);
      });
    }, 50);
  }

  async logSolicitudRejected(solicitudData, user) {
    setTimeout(() => {
      this.logAction('solicitud_rejected', {
        solicitud: solicitudData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging solicitud rejected:', error);
      });
    }, 50);
  }

  // === FICHAJE APPROVAL ===
  async logFichajeApproved(fichajeData, user) {
    setTimeout(() => {
      this.logAction('fichaje_approved', {
        fichaje: fichajeData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging fichaje approved:', error);
      });
    }, 50);
  }

  async logFichajeRejected(fichajeData, user) {
    setTimeout(() => {
      this.logAction('fichaje_rejected', {
        fichaje: fichajeData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging fichaje rejected:', error);
      });
    }, 50);
  }

  // === CLIENTES ===
  async logClienteCreated(clienteData, user) {
    setTimeout(() => {
      this.logAction('cliente_created', {
        cliente: clienteData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging cliente created:', error);
      });
    }, 50);
  }

  async logClienteUpdated(clienteData, user) {
    setTimeout(() => {
      this.logAction('cliente_updated', {
        cliente: clienteData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging cliente updated:', error);
      });
    }, 50);
  }

  async logClienteDeleted(clienteData, user) {
    setTimeout(() => {
      this.logAction('cliente_deleted', {
        cliente: clienteData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging cliente deleted:', error);
      });
    }, 50);
  }

  // === DOCUMENTOS ===
  async logDocumentoUploaded(documentoData, user) {
    setTimeout(() => {
      this.logAction('documento_uploaded', {
        documento: documentoData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging documento uploaded:', error);
      });
    }, 50);
  }

  async logDocumentoDownloaded(documentoData, user) {
    setTimeout(() => {
      this.logAction('documento_downloaded', {
        documento: documentoData,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging documento downloaded:', error);
      });
    }, 50);
  }

  // === EXPORT/IMPORT ===
  async logDataExport(type, data, user) {
    setTimeout(() => {
      this.logAction('data_export', {
        type,
        data,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging data export:', error);
      });
    }, 50);
  }

  async logDataImport(type, data, user) {
    setTimeout(() => {
      this.logAction('data_import', {
        type,
        data,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging data import:', error);
      });
    }, 50);
  }

  // === ADMIN ===
  async logPermissionsSaved(permissions, user) {
    setTimeout(() => {
      this.logAction('permissions_saved', {
        permissions,
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging permissions saved:', error);
      });
    }, 50);
  }

  async logAdminStatsViewed(user) {
    setTimeout(() => {
      this.logAction('admin_stats_viewed', {
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging admin stats viewed:', error);
      });
    }, 50);
  }

  async logActivityLogViewed(user) {
    setTimeout(() => {
      this.logAction('activity_log_viewed', {
        user: user['NOMBRE / APELLIDOS'] || user.nombre,
        email: user.email,
        grupo: user.GRUPO,
        role: user.role
      }).catch(error => {
        console.error('Error logging activity log viewed:', error);
      });
    }, 50);
  }

  // === ERROR LOGGING ===
  async logError(error, context, user) {
    setTimeout(() => {
      this.logAction('error', {
        error: error.message || error,
        stack: error.stack,
        context,
        user: user?.['NOMBRE / APELLIDOS'] || user?.nombre || 'Unknown',
        email: user?.email || 'Unknown',
        grupo: user?.GRUPO || 'Unknown',
        role: user?.role || 'Unknown'
      }).catch(logError => {
        console.error('Error logging error:', logError);
      });
    }, 50);
  }

  // === UTILITĂȚI ===
  saveLocalLog(logEntry) {
    try {
      const logs = JSON.parse(localStorage.getItem('activityLogs') || '[]');
      logs.push(logEntry);
      
      // Păstrează doar ultimele 100 log-uri
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('activityLogs', JSON.stringify(logs));
    } catch (error) {
      console.error('Error saving local log:', error);
    }
  }

  async sendToBackend(logEntry) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending to backend:', error);
      throw error;
    }
  }

  getSessionId() {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Date.now().toString(36).substr(2, 9);
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  getLocalLogs() {
    try {
      return JSON.parse(localStorage.getItem('activityLogs') || '[]');
    } catch (error) {
      console.error('Error getting local logs:', error);
      return [];
    }
  }

  clearLocalLogs() {
    try {
      localStorage.removeItem('activityLogs');
      localStorage.removeItem('sessionId');
    } catch (error) {
      console.error('Error clearing local logs:', error);
    }
  }
}

export default new ActivityLogger(); 