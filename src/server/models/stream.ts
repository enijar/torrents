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
  Index,
} from "@sequelize/core/decorators-legacy";

interface TorrentData {
  hash: string;
  quality: string;
  size: number;
  seeds: number;
}

@Table({
  tableName: "streams",
  timestamps: false,
  indexes: [
    { fields: ["popularity", "rating", "year"], name: "streams_sort_idx" },
    {
      fields: ["year", "rating", "seeds", "popularity"],
      name: "streams_filter_idx",
    },
  ],
})
export default class Stream extends Model<
  InferAttributes<Stream>,
  InferCreationAttributes<Stream>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare uuid: CreationOptional<string>;

  @Attribute(DataTypes.INTEGER)
  @NotNull
  @Unique
  declare apiId: number;

  @Attribute(DataTypes.INTEGER)
  declare tmdbId: number | null;

  @Attribute(DataTypes.FLOAT)
  @Default(0)
  declare popularity: CreationOptional<number>;

  @Attribute(DataTypes.STRING(512))
  @NotNull
  @Index
  declare title: string;

  @Attribute(DataTypes.INTEGER)
  @NotNull
  declare year: number;

  @Attribute(DataTypes.FLOAT)
  @Default(0)
  declare rating: CreationOptional<number>;

  @Attribute(DataTypes.INTEGER)
  @Default(0)
  declare duration: CreationOptional<number>;

  @Attribute(DataTypes.JSON)
  declare genres: string[] | null;

  @Attribute(DataTypes.TEXT)
  declare synopsis: string | null;

  @Attribute(DataTypes.STRING(512))
  declare youTubeTrailerCode: string | null;

  @Attribute(DataTypes.STRING(512))
  declare imdbCode: string | null;

  @Attribute(DataTypes.STRING(1024))
  declare largeCoverImage: string | null;

  @Attribute(DataTypes.STRING(1024))
  declare posterImage: string | null;

  @Attribute(DataTypes.JSON)
  @NotNull
  declare torrents: TorrentData[];

  @Attribute(DataTypes.INTEGER)
  @Default(0)
  declare seeds: CreationOptional<number>;
}
