// firebase/config.js - VERSÃO OTIMIZADA
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  enableNetwork,
  disableNetwork
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyACAAMkxTdfC51xO2WHZdr9gGsnRKj4Iew",
  authDomain: "datatac-14d16.firebaseapp.com",
  projectId: "datatac-14d16",
  storageBucket: "datatac-14d16.firebasestorage.app",
  messagingSenderId: "284083501949",
  appId: "1:284083501949:web:02e5d69234bdd4a0aa2a14",
  measurementId: "G-29VELGJ0KZ"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// 🚀 CACHE OTIMIZADO
class DataCache {
  constructor() {
    this.veiculos = new Map();
    this.proprietarios = new Map();
    this.lastUpdate = null;
    this.isLoading = false;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  }

  isValid() {
    return this.lastUpdate && (Date.now() - this.lastUpdate < this.CACHE_DURATION);
  }

  setVeiculos(veiculos) {
    this.veiculos.clear();
    veiculos.forEach(veiculo => {
      this.veiculos.set(veiculo.id, veiculo);
    });
    this.lastUpdate = Date.now();
  }

  getVeiculos() {
    return Array.from(this.veiculos.values());
  }

  invalidate() {
    this.lastUpdate = null;
  }
}

const dataCache = new DataCache();

// 🔐 Autenticação (mantida igual)
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", userCredential.user.uid), {
      ultimoLogin: Timestamp.now()
    }, { merge: true });

    return { success: true, user: userCredential.user };
  } catch (error) {
    let errorMessage = "Erro desconhecido";

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = "Usuário não encontrado";
        break;
      case 'auth/wrong-password':
        errorMessage = "Senha incorreta";
        break;
      case 'auth/invalid-email':
        errorMessage = "E-mail inválido";
        break;
      case 'auth/too-many-requests':
        errorMessage = "Muitas tentativas. Tente novamente mais tarde";
        break;
      default:
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
};

export const registerUser = async (email, password) => {
  try {
    if (password.length !== 6) {
      throw new Error("A senha deve ter exatamente 6 dígitos.");
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      email,
      plano: "Free",
      dataCriacao: Timestamp.now(),
      ultimoLogin: Timestamp.now(),
      licenca: true,
      status: "active",
      totalVeiculos: 0,
      totalProprietarios: 0,
      totalCetidoes: 0
    });

    // Inicializar subcoleções com placeholders
    await addDoc(collection(db, "users", user.uid, "veiculos"), {
      placeholder: true,
      dataCriacao: Timestamp.now(),
      observacao: "Subcoleção inicializada - este documento será removido automaticamente ao adicionar o primeiro veículo real"
    });

    await addDoc(collection(db, "users", user.uid, "proprietarios"), {
      placeholder: true,
      dataCriacao: Timestamp.now(),
      observacao: "Subcoleção inicializada - este documento será removido automaticamente ao adicionar o primeiro proprietário real"
    });

    await addDoc(collection(db, "users", user.uid, "cetidoes"), {
      placeholder: true,
      dataCriacao: Timestamp.now(),
      observacao: "Subcoleção inicializada - aqui serão armazenadas as informações dos PDFs de cronotacógrafo processados"
    });

    await addDoc(collection(db, "users", user.uid, "historico"), {
      acao: "conta_criada",
      descricao: "Conta criada com sucesso - Plano Free ativado",
      timestamp: Timestamp.now(),
      detalhes: {
        plano: "Free",
        email
      }
    });

    console.log("Usuário cadastrado com sucesso:", user.uid);
    return { success: true, user };
  } catch (error) {
    console.error("Erro no cadastro:", error);

    let errorMessage = "Erro desconhecido";

    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = "Este e-mail já está cadastrado";
        break;
      case 'auth/weak-password':
        errorMessage = "A senha deve ter pelo menos 6 caracteres";
        break;
      case 'auth/invalid-email':
        errorMessage = "E-mail inválido";
        break;
      case 'auth/operation-not-allowed':
        errorMessage = "Operação não permitida";
        break;
      default:
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
};

// 🚗 FUNÇÕES DE VEÍCULO OTIMIZADAS
export const cadastrarVeiculo = async (dadosVeiculo) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const veiculoData = {
      ...dadosVeiculo,
      dataCadastro: Timestamp.now(),
      placa: dadosVeiculo.placa?.toUpperCase().trim(),
      renavan: dadosVeiculo.renavan?.trim(),
      municipio: dadosVeiculo.municipio?.trim(),
      marca: dadosVeiculo.marca?.trim(),
      ano: dadosVeiculo.ano ? parseInt(dadosVeiculo.ano) : null,
      proprietarioId: null,
      proprietarioDocumento: null,
      proprietarioNome: null,
      temProprietario: false
    };

    const docRef = await addDoc(collection(db, "users", user.uid, "veiculos"), veiculoData);
    
    await removerPlaceholder(user.uid, "veiculos");
    await atualizarContador(user.uid, "totalVeiculos", 1);
    
    await registrarHistorico(user.uid, "veiculo_cadastrado", `Veículo ${veiculoData.placa} cadastrado`, {
      veiculoId: docRef.id,
      placa: veiculoData.placa
    });

    // 🚀 INVALIDAR CACHE APÓS CADASTRO
    dataCache.invalidate();

    return { success: true, id: docRef.id, veiculoData: veiculoData };
  } catch (error) {
    console.error("Erro ao cadastrar veículo:", error);
    return { success: false, error: error.message };
  }
};

// 👤 FUNÇÕES DE PROPRIETÁRIO OTIMIZADAS
export const cadastrarProprietario = async (dadosProprietario) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const documento = dadosProprietario.documento?.trim();
    const nome = dadosProprietario.nome?.trim();
    const cnh = dadosProprietario.cnh?.trim() || "NÃO INFORMADO";

    if (!documento) throw new Error("Documento (CPF/CNPJ) é obrigatório");
    if (!nome) throw new Error("Nome/Razão Social é obrigatório");

    const documentoLimpo = documento.replace(/[^\d]/g, '');
    let tipoDocumento = '';
    
    if (documentoLimpo.length === 11) {
      tipoDocumento = 'CPF';
    } else if (documentoLimpo.length === 14) {
      tipoDocumento = 'CNPJ';
    } else {
      throw new Error("Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)");
    }

    const proprietarioData = {
      documento: documento,
      tipoDocumento: tipoDocumento,
      nome: nome,
      cnh: cnh,
      dataCadastro: Timestamp.now(),
      veiculosVinculados: [],
      placasVinculadas: [],
      totalVeiculos: 0
    };

    const docRef = await addDoc(collection(db, "users", user.uid, "proprietarios"), proprietarioData);
    
    await removerPlaceholder(user.uid, "proprietarios");
    await atualizarContador(user.uid, "totalProprietarios", 1);
    
    await registrarHistorico(user.uid, "proprietario_cadastrado", `Proprietário ${nome} cadastrado (${tipoDocumento}: ${documento})`, {
      proprietarioId: docRef.id,
      nome: nome,
      tipoDocumento: tipoDocumento,
      documento: documento
    });

    // 🚀 INVALIDAR CACHE APÓS CADASTRO
    dataCache.invalidate();

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Erro ao cadastrar proprietário:", error);
    return { success: false, error: error.message };
  }
};

// 📄 FUNÇÃO DE CETIDÃO OTIMIZADA
export const cadastrarCetidao = async (dadosCetidao) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const cetidaoData = {
      ...dadosCetidao,
      dataCadastro: Timestamp.now(),
      dataProcessamento: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, "users", user.uid, "cetidoes"), cetidaoData);
    
    await removerPlaceholder(user.uid, "cetidoes");
    await atualizarContador(user.uid, "totalCetidoes", 1);
    
    await registrarHistorico(user.uid, "cetidao_processada", `Certidão processada com sucesso`, {
      cetidaoId: docRef.id
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Erro ao cadastrar cetidão:", error);
    return { success: false, error: error.message };
  }
};

// 🔧 FUNÇÕES AUXILIARES (mantidas)
const removerPlaceholder = async (uid, colecao) => {
  try {
    const placeholderQuery = query(
      collection(db, "users", uid, colecao),
      where("placeholder", "==", true)
    );
    const snapshot = await getDocs(placeholderQuery);
    
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.warn(`Erro ao remover placeholder de ${colecao}:`, error);
  }
};

const atualizarContador = async (uid, campo, incremento) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      [campo]: increment(incremento)
    });
  } catch (error) {
    console.warn(`Erro ao atualizar contador ${campo}:`, error);
  }
};

const registrarHistorico = async (uid, acao, descricao, detalhes = {}) => {
  try {
    await addDoc(collection(db, "users", uid, "historico"), {
      acao,
      descricao,
      timestamp: Timestamp.now(),
      detalhes
    });
  } catch (error) {
    console.warn("Erro ao registrar histórico:", error);
  }
};

// 🔗 FUNÇÕES DE VINCULAÇÃO (mantidas)
export const vincularProprietarioVeiculo = async (proprietarioId, veiculoId, proprietarioDocumento, proprietarioNome, placa) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const veiculoRef = doc(db, "users", user.uid, "veiculos", veiculoId);
    await updateDoc(veiculoRef, {
      proprietarioId: proprietarioId,
      proprietarioDocumento: proprietarioDocumento,
      proprietarioNome: proprietarioNome,
      temProprietario: true,
      dataVinculacao: Timestamp.now()
    });

    const proprietarioRef = doc(db, "users", user.uid, "proprietarios", proprietarioId);
    const proprietarioDoc = await getDoc(proprietarioRef);
    
    if (proprietarioDoc.exists()) {
      const dadosProprietario = proprietarioDoc.data();
      const veiculosAtuais = dadosProprietario.veiculosVinculados || [];
      const placasAtuais = dadosProprietario.placasVinculadas || [];
      
      if (!veiculosAtuais.includes(veiculoId)) {
        await updateDoc(proprietarioRef, {
          veiculosVinculados: [...veiculosAtuais, veiculoId],
          placasVinculadas: [...placasAtuais, placa],
          totalVeiculos: increment(1),
          ultimaVinculacao: Timestamp.now()
        });
      }
    }

    await registrarHistorico(user.uid, "vinculacao_realizada", `Veículo ${placa} vinculado ao proprietário ${proprietarioNome}`, {
      veiculoId,
      proprietarioId,
      placa,
      proprietarioDocumento
    });

    // 🚀 INVALIDAR CACHE APÓS VINCULAÇÃO
    dataCache.invalidate();

    return { success: true };
  } catch (error) {
    console.error("Erro ao vincular proprietário-veículo:", error);
    return { success: false, error: error.message };
  }
};

export const desvincularProprietarioVeiculo = async (proprietarioId, veiculoId, placa) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const veiculoRef = doc(db, "users", user.uid, "veiculos", veiculoId);
    await updateDoc(veiculoRef, {
      proprietarioId: null,
      proprietarioDocumento: null,
      proprietarioNome: null,
      temProprietario: false,
      dataDesvinculacao: Timestamp.now()
    });

    const proprietarioRef = doc(db, "users", user.uid, "proprietarios", proprietarioId);
    const proprietarioDoc = await getDoc(proprietarioRef);
    
    if (proprietarioDoc.exists()) {
      const dadosProprietario = proprietarioDoc.data();
      const veiculosAtuais = dadosProprietario.veiculosVinculados || [];
      const placasAtuais = dadosProprietario.placasVinculadas || [];
      
      await updateDoc(proprietarioRef, {
        veiculosVinculados: veiculosAtuais.filter(id => id !== veiculoId),
        placasVinculadas: placasAtuais.filter(p => p !== placa),
        totalVeiculos: increment(-1),
        ultimaDesvinculacao: Timestamp.now()
      });
    }

    await registrarHistorico(user.uid, "desvinculacao_realizada", `Veículo ${placa} desvinculado do proprietário`, {
      veiculoId,
      proprietarioId,
      placa
    });

    // 🚀 INVALIDAR CACHE APÓS DESVINCULAÇÃO
    dataCache.invalidate();

    return { success: true };
  } catch (error) {
    console.error("Erro ao desvincular proprietário-veículo:", error);
    return { success: false, error: error.message };
  }
};

// 📊 🚀 FUNÇÕES OTIMIZADAS PARA CONSULTA RÁPIDA
export const listarVeiculosComProprietarios = async (opcoes = {}) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const {
      useCache = true,
      forceRefresh = false,
      limitDocs = 100,
      orderByField = 'dataCadastro',
      orderDirection = 'desc'
    } = opcoes;

    // 🚀 VERIFICAR CACHE PRIMEIRO
    if (useCache && !forceRefresh && dataCache.isValid()) {
      console.log("🚀 Dados retornados do cache");
      return { 
        success: true, 
        veiculos: dataCache.getVeiculos(),
        source: 'cache'
      };
    }

    // 🚀 QUERY OTIMIZADA COM ÍNDICES
    const veiculosQuery = query(
      collection(db, "users", user.uid, "veiculos"),
      where("placeholder", "!=", true), // Usar índice composto
      orderBy(orderByField, orderDirection),
      limit(limitDocs)
    );

    console.time("⏱️ Tempo de consulta Firebase");
    const snapshot = await getDocs(veiculosQuery);
    console.timeEnd("⏱️ Tempo de consulta Firebase");
    
    const veiculos = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      veiculos.push({
        id: doc.id,
        ...data
      });
    });

    // 🚀 ATUALIZAR CACHE
    if (useCache) {
      dataCache.setVeiculos(veiculos);
    }

    console.log(`📊 ${veiculos.length} veículos carregados do Firebase`);
    
    return { 
      success: true, 
      veiculos,
      source: 'firebase',
      count: veiculos.length 
    };

  } catch (error) {
    console.error("Erro ao listar veículos:", error);
    return { success: false, error: error.message };
  }
};

// 🚀 NOVA FUNÇÃO: BUSCA PAGINADA
export const listarVeiculosPaginado = async (lastDoc = null, limitDocs = 50) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    let veiculosQuery = query(
      collection(db, "users", user.uid, "veiculos"),
      where("placeholder", "!=", true),
      orderBy('dataCadastro', 'desc'),
      limit(limitDocs)
    );

    if (lastDoc) {
      veiculosQuery = query(
        collection(db, "users", user.uid, "veiculos"),
        where("placeholder", "!=", true),
        orderBy('dataCadastro', 'desc'),
        startAfter(lastDoc),
        limit(limitDocs)
      );
    }

    const snapshot = await getDocs(veiculosQuery);
    const veiculos = [];
    let ultimoDoc = null;

    snapshot.forEach((doc) => {
      const data = doc.data();
      veiculos.push({
        id: doc.id,
        ...data
      });
      ultimoDoc = doc;
    });

    return { 
      success: true, 
      veiculos,
      lastDoc: ultimoDoc,
      hasMore: veiculos.length === limitDocs
    };

  } catch (error) {
    console.error("Erro na busca paginada:", error);
    return { success: false, error: error.message };
  }
};

// 🚀 FUNÇÃO DE BUSCA OTIMIZADA
export const buscarVeiculosOtimizada = async (termo, campo = 'placa') => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    // Para busca por placa (mais comum)
    if (campo === 'placa') {
      const veiculosQuery = query(
        collection(db, "users", user.uid, "veiculos"),
        where("placa", "==", termo.toUpperCase()),
        limit(10)
      );

      const snapshot = await getDocs(veiculosQuery);
      const veiculos = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.placeholder) {
          veiculos.push({
            id: doc.id,
            ...data
          });
        }
      });

      return { success: true, veiculos };
    }

    // Para outros campos, usar cache se disponível
    if (dataCache.isValid()) {
      const todosVeiculos = dataCache.getVeiculos();
      const veiculosFiltrados = todosVeiculos.filter(veiculo => {
        const valorCampo = veiculo[campo] || '';
        return valorCampo.toLowerCase().includes(termo.toLowerCase());
      });
      
      return { success: true, veiculos: veiculosFiltrados };
    }

    // Fallback para busca completa
    return await listarVeiculosComProprietarios({ limitDocs: 1000 });

  } catch (error) {
    console.error("Erro na busca otimizada:", error);
    return { success: false, error: error.message };
  }
};

// 🚀 ESTATÍSTICAS RÁPIDAS DO USUÁRIO
export const obterEstatisticasRapidas = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        success: true,
        stats: {
          totalVeiculos: data.totalVeiculos || 0,
          totalProprietarios: data.totalProprietarios || 0,
          totalCetidoes: data.totalCetidoes || 0,
          plano: data.plano || 'Free',
          ultimoLogin: data.ultimoLogin
        }
      };
    }

    return { success: false, error: "Dados do usuário não encontrados" };

  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    return { success: false, error: error.message };
  }
};

// 🚀 FUNÇÃO PARA INVALIDAR CACHE MANUALMENTE
export const invalidarCache = () => {
  dataCache.invalidate();
  console.log("🚀 Cache invalidado manualmente");
};

// Funções mantidas do código original
export const listarProprietariosComVeiculos = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const proprietariosQuery = query(collection(db, "users", user.uid, "proprietarios"));
    const snapshot = await getDocs(proprietariosQuery);
    
    const proprietarios = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.placeholder) {
        proprietarios.push({
          id: doc.id,
          ...data
        });
      }
    });

    return { success: true, proprietarios };
  } catch (error) {
    console.error("Erro ao listar proprietários:", error);
    return { success: false, error: error.message };
  }
};

export const buscarVeiculoPorPlaca = async (placa) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const veiculosQuery = query(
      collection(db, "users", user.uid, "veiculos"),
      where("placa", "==", placa.toUpperCase())
    );
    const snapshot = await getDocs(veiculosQuery);
    
    if (snapshot.empty) {
      return { success: false, error: "Veículo não encontrado" };
    }

    const veiculo = {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };

    return { success: true, veiculo };
  } catch (error) {
    console.error("Erro ao buscar veículo:", error);
    return { success: false, error: error.message };
  }
};

export const buscarProprietarioPorDocumento = async (documento) => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const proprietariosQuery = query(
      collection(db, "users", user.uid, "proprietarios"),
      where("documento", "==", documento)
    );
    const snapshot = await getDocs(proprietariosQuery);
    
    if (snapshot.empty) {
      return { success: false, error: "Proprietário não encontrado" };
    }

    const proprietario = {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };

    return { success: true, proprietario };
  } catch (error) {
    console.error("Erro ao buscar proprietário:", error);
    return { success: false, error: error.message };
  }
};

export const upgradeToPremium = async () => {
  try {
    const criarPagamento = httpsCallable(functions, 'criarPagamentoPix');
    const result = await criarPagamento();
    return { success: true, data: result.data };
  } catch (error) {
    console.error("Erro no upgrade:", error);
    return { success: false, error: error.message };
  }
};

// Verificar usuário autenticado de forma confiável
export const getCurrentUser = () => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// Logout
export const logoutUser = async () => {
  try {
    await signOut(auth);
    // 🚀 LIMPAR CACHE NO LOGOUT
    dataCache.invalidate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Exportar instâncias
export { auth, db, functions, Timestamp };