import {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  DataTypes,
  sql,
} from "@sequelize/core";
import {
  Table,
  Attribute,
  PrimaryKey,
  Default,
  NotNull,
  Unique,
} from "@sequelize/core/decorators-legacy";

interface CachedFile {
  name: string;
  path: string;
}

@Table({ tableName: "cached_streams", timestamps: false })
export default class CachedStream extends Model<
  InferAttributes<CachedStream>,
  InferCreationAttributes<CachedStream>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare uuid: CreationOptional<string>;

  @Attribute(DataTypes.STRING)
  @NotNull
  @Unique
  declare hash: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare name: string;

  @Attribute(DataTypes.JSON)
  @NotNull
  declare files: CachedFile[];

  @Attribute(DataTypes.DATE)
  @NotNull
  declare expiresAt: Date;
}
