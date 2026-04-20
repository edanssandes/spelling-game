# Spelling Game Kids (Single Page)

Jogo em HTML/CSS/JavaScript, sem backend, compatível com desktop e celular.

## Como usar

1. Abra o arquivo `index.html` em um navegador moderno (Chrome/Edge/Firefox).
2. Digite o nome do jogador.
3. Escolha a dificuldade.
4. (Opcional) Carregue:
   - Pasta de temas (`.txt`), onde cada linha tem um nome de mp3 (com ou sem `.mp3`).
   - Pasta de áudios (`.mp3`).
5. Escolha o tema e clique em **Iniciar Jogo**.

## Regras implementadas

- Rodada começa com `n = 4` palavras.
- Cada nova rodada aumenta `n` em `+1` até `10`.
- A partir de `10`, permanece em `10`.
- Só passa de rodada quando acertar todas as palavras da rodada ao menos uma vez.
- Palavra errada volta para o fim da fila da rodada.
- Erro: efeito de terremoto + letras erradas em vermelho.
- Após terremoto: resposta correta toda em verde.
- Acerto total da rodada: animação de fogos e avanço.

## Dificuldades

- Fácil: sempre 2 letras para preencher (resto já vem preenchido).
- Médio: tenta deixar no máximo 2 letras preenchidas e no mínimo 3 para preencher.
- Difícil: nenhuma letra preenchida.

## Áudio automático (fallback)

Se não houver mp3 correspondente ao nome da palavra, o jogo usa **Web Speech API** (voz do navegador em inglês) para falar a palavra automaticamente.

## Formato dos temas

Exemplo de arquivo `animais.txt`:

```txt
elephant.mp3
giraffe.mp3
monkey.mp3
```

Os nomes dos mp3 são tratados como resposta correta (case-insensitive).

## Arquivos de exemplo

- `sample/themes/animals.txt`
- `sample/themes/food.txt`

Esses exemplos funcionam mesmo sem mp3, usando voz automática.
