const ADMIN_PRIORITY_THRESHOLD = 1000;
const USER_MAX_VISIBLE_VALUE = 500;

/**
 * Formato de relatório. Também serve como Null Object para tipos desconhecidos,
 * que geram um relatório vazio.
 */
class ReportFormat {
  header() {
    return '';
  }

  row() {
    return '';
  }

  footer() {
    return '';
  }
}

class CsvFormat extends ReportFormat {
  header() {
    return 'ID,NOME,VALOR,USUARIO\n';
  }

  row(item, user) {
    return `${item.id},${item.name},${item.value},${user.name}\n`;
  }

  footer(total) {
    return `\nTotal,,\n${total},,\n`;
  }
}

class HtmlFormat extends ReportFormat {
  header(user) {
    return [
      '<html><body>\n',
      '<h1>Relatório</h1>\n',
      `<h2>Usuário: ${user.name}</h2>\n`,
      '<table>\n',
      '<tr><th>ID</th><th>Nome</th><th>Valor</th></tr>\n',
    ].join('');
  }

  row(item, _user, isHighlighted) {
    const openingTag = isHighlighted ? '<tr style="font-weight:bold;">' : '<tr>';
    return `${openingTag}<td>${item.id}</td><td>${item.name}</td><td>${item.value}</td></tr>\n`;
  }

  footer(total) {
    return `</table>\n<h3>Total: ${total}</h3>\n</body></html>\n`;
  }
}

/**
 * Regras de visibilidade de um papel. Também serve como Null Object para papéis
 * desconhecidos, que não veem nenhum item.
 */
class RolePolicy {
  prepare() {}

  canView() {
    return false;
  }

  isHighlighted() {
    return false;
  }
}

/** Admins veem tudo; itens acima do limite são marcados como prioritários. */
class AdminPolicy extends RolePolicy {
  prepare(item) {
    if (item.value > ADMIN_PRIORITY_THRESHOLD) {
      item.priority = true;
    }
  }

  canView() {
    return true;
  }

  isHighlighted(item) {
    return Boolean(item.priority);
  }
}

/** Users comuns só veem itens de valor baixo. */
class UserPolicy extends RolePolicy {
  canView(item) {
    return item.value <= USER_MAX_VISIBLE_VALUE;
  }
}

const FORMATS = new Map([
  ['CSV', new CsvFormat()],
  ['HTML', new HtmlFormat()],
]);
const DEFAULT_FORMAT = new ReportFormat();

const POLICIES = new Map([
  ['ADMIN', new AdminPolicy()],
  ['USER', new UserPolicy()],
]);
const DEFAULT_POLICY = new RolePolicy();

export class ReportGenerator {
  constructor(database) {
    this.db = database;
  }

  /**
   * Gera um relatório de itens baseado no tipo e no usuário.
   * - Admins veem tudo.
   * - Users comuns só veem itens com valor <= 500.
   */
  generateReport(reportType, user, items) {
    const format = FORMATS.get(reportType) ?? DEFAULT_FORMAT;
    const policy = POLICIES.get(user.role) ?? DEFAULT_POLICY;

    const visibleItems = this.#selectVisibleItems(policy, items);
    const rows = visibleItems.map((item) =>
      format.row(item, user, policy.isHighlighted(item)),
    );

    const report = [
      format.header(user),
      ...rows,
      format.footer(this.#sumValues(visibleItems)),
    ].join('');

    return report.trim();
  }

  #selectVisibleItems(policy, items) {
    return [...items].filter((item) => {
      policy.prepare(item);
      return policy.canView(item);
    });
  }

  #sumValues(items) {
    return items.reduce((total, item) => total + item.value, 0);
  }
}
