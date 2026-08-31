CREATE TYPE "public"."funcao_colaborador" AS ENUM('motorista', 'ajudante', 'atendimento', 'logistica');--> statement-breakpoint
CREATE TYPE "public"."tipo_registro" AS ENUM('viagem', 'abastecimento', 'manutencao', 'quebra');--> statement-breakpoint
CREATE TYPE "public"."tipo_manutencao" AS ENUM('preventiva', 'corretiva');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('apolice', 'crlv', 'tacografo', 'cnh', 'manual', 'plano_pgq');--> statement-breakpoint
CREATE TYPE "public"."direcao_meta" AS ENUM('menor_melhor', 'maior_melhor');--> statement-breakpoint
CREATE TABLE "base" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "base_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "colaborador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"cargo" text,
	"funcao" "funcao_colaborador" NOT NULL,
	"admissao" date,
	"base_id" uuid NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rota" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"base_id" uuid NOT NULL,
	"local" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "rota_nome_base_uk" UNIQUE("nome","base_id")
);
--> statement-breakpoint
CREATE TABLE "veiculo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"placa" text NOT NULL,
	"modelo" text,
	"marca" text,
	"ano" text,
	"base_id" uuid NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "veiculo_placa_unique" UNIQUE("placa")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_issuer_accountId_uidx" UNIQUE("issuer","account_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "usuario_base" (
	"usuario_id" text NOT NULL,
	"base_id" uuid NOT NULL,
	CONSTRAINT "usuario_base_usuario_id_base_id_pk" PRIMARY KEY("usuario_id","base_id")
);
--> statement-breakpoint
CREATE TABLE "usuario_tipo" (
	"usuario_id" text NOT NULL,
	"tipo" "tipo_registro" NOT NULL,
	CONSTRAINT "usuario_tipo_usuario_id_tipo_pk" PRIMARY KEY("usuario_id","tipo")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abastecimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid NOT NULL,
	"veiculo_id" uuid NOT NULL,
	"rota_id" uuid,
	"data" date NOT NULL,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "abastecimento_parada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"abastecimento_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"litros" numeric(10, 2) NOT NULL,
	"vl_litro" numeric(10, 3) NOT NULL,
	"km" integer,
	"posto" text,
	"valor_total" numeric(12, 2) GENERATED ALWAYS AS (ROUND(litros * vl_litro, 2)) STORED,
	CONSTRAINT "abastecimento_parada_ordem_uk" UNIQUE("abastecimento_id","ordem"),
	CONSTRAINT "abastecimento_parada_ordem_ck" CHECK ("abastecimento_parada"."ordem" BETWEEN 1 AND 3),
	CONSTRAINT "abastecimento_parada_nao_negativo_ck" CHECK ("abastecimento_parada"."litros" >= 0 AND "abastecimento_parada"."vl_litro" >= 0)
);
--> statement-breakpoint
CREATE TABLE "manutencao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid NOT NULL,
	"veiculo_id" uuid NOT NULL,
	"tipo_manutencao" "tipo_manutencao" NOT NULL,
	"data_programada" date,
	"data_entrada" date NOT NULL,
	"hora_entrada" time,
	"data_saida" date,
	"hora_saida" time,
	"servico" text NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"km_odometro" integer,
	"fornecedor" text,
	"orcamento_arquivo_id" uuid,
	"os_arquivo_id" uuid,
	"dias_oficina" integer GENERATED ALWAYS AS (data_saida - data_entrada) STORED,
	"status_documental" boolean GENERATED ALWAYS AS (orcamento_arquivo_id IS NOT NULL AND os_arquivo_id IS NOT NULL) STORED,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone,
	CONSTRAINT "manutencao_saida_ck" CHECK ("manutencao"."data_saida" IS NULL OR "manutencao"."data_saida" >= "manutencao"."data_entrada"),
	CONSTRAINT "manutencao_valor_ck" CHECK ("manutencao"."valor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quebra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid NOT NULL,
	"data" date NOT NULL,
	"m2_expedido" numeric(12, 2) NOT NULL,
	"m2_quebrado" numeric(12, 2) NOT NULL,
	"observacao" text,
	"pct_quebra" numeric(12, 2) GENERATED ALWAYS AS (ROUND(m2_quebrado / NULLIF(m2_expedido, 0) * 100, 2)) STORED,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone,
	CONSTRAINT "quebra_nao_negativo_ck" CHECK ("quebra"."m2_expedido" >= 0 AND "quebra"."m2_quebrado" >= 0)
);
--> statement-breakpoint
CREATE TABLE "viagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" uuid NOT NULL,
	"veiculo_id" uuid NOT NULL,
	"motorista_id" uuid NOT NULL,
	"rota_id" uuid NOT NULL,
	"data_saida" date NOT NULL,
	"hora_saida" time,
	"hora_prevista" time,
	"data_prevista" date,
	"data_chegada" date,
	"hora_chegada" time,
	"km_saida" integer NOT NULL,
	"km_chegada" integer,
	"valor_carga" numeric(12, 2) NOT NULL,
	"combustivel" numeric(12, 2) NOT NULL,
	"diarias" numeric(12, 2) NOT NULL,
	"m2" numeric(12, 2),
	"peso_kg" numeric(12, 2),
	"observacao" text,
	"km_rodados" integer GENERATED ALWAYS AS (CASE WHEN km_chegada > km_saida THEN km_chegada - km_saida END) STORED,
	"custo_viagem" numeric(12, 2) GENERATED ALWAYS AS (ROUND((combustivel + diarias)::numeric, 2)) STORED,
	"pct_custo" numeric(12, 2) GENERATED ALWAYS AS (ROUND((combustivel + diarias) / NULLIF(valor_carga, 0) * 100, 2)) STORED,
	"atraso_min" integer GENERATED ALWAYS AS (FLOOR(
        EXTRACT(
          EPOCH FROM
            (data_chegada + hora_chegada)
            - (COALESCE(data_prevista, data_saida) + hora_prevista)
        ) / 60 + 0.5
      )::integer) STORED,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone,
	CONSTRAINT "viagem_chegada_ck" CHECK (("viagem"."data_chegada" IS NULL AND "viagem"."hora_chegada" IS NULL AND "viagem"."km_chegada" IS NULL)
          OR ("viagem"."data_chegada" IS NOT NULL AND "viagem"."hora_chegada" IS NOT NULL AND "viagem"."km_chegada" IS NOT NULL)),
	CONSTRAINT "viagem_previsao_ck" CHECK ("viagem"."data_prevista" IS NULL OR "viagem"."hora_prevista" IS NOT NULL),
	CONSTRAINT "viagem_nao_negativo_ck" CHECK ("viagem"."km_saida" >= 0 AND "viagem"."valor_carga" >= 0 AND "viagem"."combustivel" >= 0 AND "viagem"."diarias" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arquivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome_original" text NOT NULL,
	"mime" text NOT NULL,
	"tamanho" integer NOT NULL,
	"caminho" text NOT NULL,
	"sha256" text NOT NULL,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone,
	CONSTRAINT "arquivo_caminho_unique" UNIQUE("caminho")
);
--> statement-breakpoint
CREATE TABLE "documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_documento" NOT NULL,
	"titulo" text,
	"descricao" text,
	"vencimento" date,
	"arquivo_id" uuid,
	"link_externo" text,
	"veiculo_id" uuid,
	"colaborador_id" uuid,
	"base_id" uuid,
	"seguradora" text,
	"cnh_numero" text,
	"cnh_categoria" text,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone,
	CONSTRAINT "documento_id_tipo_uk" UNIQUE("id","tipo"),
	CONSTRAINT "documento_vencimento_ck" CHECK (CASE WHEN "documento"."tipo" IN ('apolice', 'crlv', 'tacografo', 'cnh')
            THEN "documento"."vencimento" IS NOT NULL
            ELSE "documento"."vencimento" IS NULL END),
	CONSTRAINT "documento_cnh_ck" CHECK (CASE WHEN "documento"."tipo" = 'cnh'
            THEN "documento"."cnh_numero" IS NOT NULL AND "documento"."cnh_categoria" IS NOT NULL
            ELSE "documento"."cnh_numero" IS NULL AND "documento"."cnh_categoria" IS NULL END),
	CONSTRAINT "documento_veiculo_ck" CHECK (CASE WHEN "documento"."tipo" IN ('apolice', 'crlv', 'tacografo')
            THEN "documento"."veiculo_id" IS NOT NULL
            ELSE "documento"."veiculo_id" IS NULL END),
	CONSTRAINT "documento_colaborador_ck" CHECK (CASE WHEN "documento"."tipo" = 'cnh'
            THEN "documento"."colaborador_id" IS NOT NULL
            ELSE "documento"."colaborador_id" IS NULL END),
	CONSTRAINT "documento_base_ck" CHECK (CASE WHEN "documento"."tipo" = 'plano_pgq'
            THEN "documento"."base_id" IS NOT NULL
            ELSE "documento"."base_id" IS NULL END),
	CONSTRAINT "documento_fonte_ck" CHECK ("documento"."arquivo_id" IS NOT NULL OR "documento"."link_externo" IS NOT NULL),
	CONSTRAINT "documento_seguradora_ck" CHECK ("documento"."seguradora" IS NULL OR "documento"."tipo" = 'apolice')
);
--> statement-breakpoint
CREATE TABLE "documento_veiculo" (
	"documento_id" uuid NOT NULL,
	"tipo" "tipo_documento" NOT NULL,
	"veiculo_id" uuid NOT NULL,
	CONSTRAINT "documento_veiculo_documento_id_veiculo_id_pk" PRIMARY KEY("documento_id","veiculo_id"),
	CONSTRAINT "documento_veiculo_tipo_ck" CHECK ("documento_veiculo"."tipo" = 'manual')
);
--> statement-breakpoint
CREATE TABLE "politica_documento" (
	"tipo" "tipo_documento" PRIMARY KEY NOT NULL,
	"alerta_dias" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_preventivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"veiculo_id" uuid NOT NULL,
	"tipo_preventivo_id" uuid NOT NULL,
	"intervalo_km" integer NOT NULL,
	"alerta_km" integer NOT NULL,
	"ultimo_km" integer,
	"obs" text,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone,
	CONSTRAINT "item_preventivo_veiculo_tipo_uk" UNIQUE("veiculo_id","tipo_preventivo_id")
);
--> statement-breakpoint
CREATE TABLE "tipo_preventivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"intervalo_km" integer NOT NULL,
	"alerta_km" integer NOT NULL,
	CONSTRAINT "tipo_preventivo_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "ata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" text NOT NULL,
	"titulo" text NOT NULL,
	"data" date NOT NULL,
	"horario" time,
	"local" text,
	"convocada" text,
	"facilitadores" text,
	"participantes_geral" text,
	"gestor1_nome" text,
	"gestor1_cargo" text,
	"gestor2_nome" text,
	"gestor2_cargo" text,
	"pdf_arquivo_id" uuid,
	"importada" boolean DEFAULT false NOT NULL,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone,
	CONSTRAINT "ata_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "ata_participante" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ata_id" uuid NOT NULL,
	"colaborador_id" uuid,
	"nome_externo" text,
	"presente" boolean DEFAULT true NOT NULL,
	CONSTRAINT "ata_participante_pessoa_ck" CHECK ("ata_participante"."colaborador_id" IS NOT NULL OR "ata_participante"."nome_externo" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "ata_topico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ata_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"discussao" text,
	"conclusao" text,
	"responsavel" text,
	"prazo" date,
	CONSTRAINT "ata_topico_ordem_uk" UNIQUE("ata_id","ordem")
);
--> statement-breakpoint
CREATE TABLE "integracao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid,
	"nome_livre" text NOT NULL,
	"cargo" text,
	"admissao" date,
	"programa_id" uuid NOT NULL,
	"inicio" date,
	"coord" text,
	"gerente" text,
	"rh" text,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"apagado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integracao_atividade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integracao_id" uuid NOT NULL,
	"atividade_id" uuid NOT NULL,
	"feito" boolean DEFAULT false NOT NULL,
	"data" date,
	CONSTRAINT "integracao_atividade_uk" UNIQUE("integracao_id","atividade_id")
);
--> statement-breakpoint
CREATE TABLE "programa_atividade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"semana_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"ordem" integer NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text NOT NULL,
	CONSTRAINT "programa_atividade_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "programa_atividade_ordem_uk" UNIQUE("semana_id","ordem")
);
--> statement-breakpoint
CREATE TABLE "programa_criterio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programa_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"criterio" text NOT NULL,
	"padrao" text NOT NULL,
	"frequencia" text NOT NULL,
	CONSTRAINT "programa_criterio_ordem_uk" UNIQUE("programa_id","ordem")
);
--> statement-breakpoint
CREATE TABLE "programa_integracao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funcao" "funcao_colaborador" NOT NULL,
	"titulo" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "programa_integracao_funcao_unique" UNIQUE("funcao")
);
--> statement-breakpoint
CREATE TABLE "programa_semana" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programa_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"titulo" text NOT NULL,
	CONSTRAINT "programa_semana_numero_uk" UNIQUE("programa_id","numero")
);
--> statement-breakpoint
CREATE TABLE "meta" (
	"chave" text PRIMARY KEY NOT NULL,
	"direcao" "direcao_meta" NOT NULL,
	"limite_ok" numeric(12, 4) NOT NULL,
	"limite_atencao" numeric(12, 4)
);
--> statement-breakpoint
CREATE TABLE "parametro" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" numeric(12, 4) NOT NULL,
	"descricao" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "colaborador" ADD CONSTRAINT "colaborador_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rota" ADD CONSTRAINT "rota_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veiculo" ADD CONSTRAINT "veiculo_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_base" ADD CONSTRAINT "usuario_base_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_base" ADD CONSTRAINT "usuario_base_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_tipo" ADD CONSTRAINT "usuario_tipo_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_veiculo_id_veiculo_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_rota_id_rota_id_fk" FOREIGN KEY ("rota_id") REFERENCES "public"."rota"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abastecimento_parada" ADD CONSTRAINT "abastecimento_parada_abastecimento_id_abastecimento_id_fk" FOREIGN KEY ("abastecimento_id") REFERENCES "public"."abastecimento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_veiculo_id_veiculo_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_orcamento_arquivo_id_arquivo_id_fk" FOREIGN KEY ("orcamento_arquivo_id") REFERENCES "public"."arquivo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_os_arquivo_id_arquivo_id_fk" FOREIGN KEY ("os_arquivo_id") REFERENCES "public"."arquivo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quebra" ADD CONSTRAINT "quebra_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quebra" ADD CONSTRAINT "quebra_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quebra" ADD CONSTRAINT "quebra_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_veiculo_id_veiculo_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_motorista_id_colaborador_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."colaborador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_rota_id_rota_id_fk" FOREIGN KEY ("rota_id") REFERENCES "public"."rota"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arquivo" ADD CONSTRAINT "arquivo_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arquivo" ADD CONSTRAINT "arquivo_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_arquivo_id_arquivo_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "public"."arquivo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_veiculo_id_veiculo_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_colaborador_id_colaborador_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaborador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_base_id_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_veiculo" ADD CONSTRAINT "documento_veiculo_veiculo_id_veiculo_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_veiculo" ADD CONSTRAINT "documento_veiculo_documento_fk" FOREIGN KEY ("documento_id","tipo") REFERENCES "public"."documento"("id","tipo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_preventivo" ADD CONSTRAINT "item_preventivo_veiculo_id_veiculo_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_preventivo" ADD CONSTRAINT "item_preventivo_tipo_preventivo_id_tipo_preventivo_id_fk" FOREIGN KEY ("tipo_preventivo_id") REFERENCES "public"."tipo_preventivo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_preventivo" ADD CONSTRAINT "item_preventivo_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_preventivo" ADD CONSTRAINT "item_preventivo_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ata" ADD CONSTRAINT "ata_pdf_arquivo_id_arquivo_id_fk" FOREIGN KEY ("pdf_arquivo_id") REFERENCES "public"."arquivo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ata" ADD CONSTRAINT "ata_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ata" ADD CONSTRAINT "ata_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ata_participante" ADD CONSTRAINT "ata_participante_ata_id_ata_id_fk" FOREIGN KEY ("ata_id") REFERENCES "public"."ata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ata_participante" ADD CONSTRAINT "ata_participante_colaborador_id_colaborador_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaborador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ata_topico" ADD CONSTRAINT "ata_topico_ata_id_ata_id_fk" FOREIGN KEY ("ata_id") REFERENCES "public"."ata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integracao" ADD CONSTRAINT "integracao_colaborador_id_colaborador_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaborador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integracao" ADD CONSTRAINT "integracao_programa_id_programa_integracao_id_fk" FOREIGN KEY ("programa_id") REFERENCES "public"."programa_integracao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integracao" ADD CONSTRAINT "integracao_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integracao" ADD CONSTRAINT "integracao_atualizado_por_user_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integracao_atividade" ADD CONSTRAINT "integracao_atividade_integracao_id_integracao_id_fk" FOREIGN KEY ("integracao_id") REFERENCES "public"."integracao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integracao_atividade" ADD CONSTRAINT "integracao_atividade_atividade_id_programa_atividade_id_fk" FOREIGN KEY ("atividade_id") REFERENCES "public"."programa_atividade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programa_atividade" ADD CONSTRAINT "programa_atividade_semana_id_programa_semana_id_fk" FOREIGN KEY ("semana_id") REFERENCES "public"."programa_semana"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programa_criterio" ADD CONSTRAINT "programa_criterio_programa_id_programa_integracao_id_fk" FOREIGN KEY ("programa_id") REFERENCES "public"."programa_integracao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programa_semana" ADD CONSTRAINT "programa_semana_programa_id_programa_integracao_id_fk" FOREIGN KEY ("programa_id") REFERENCES "public"."programa_integracao"("id") ON DELETE cascade ON UPDATE no action;